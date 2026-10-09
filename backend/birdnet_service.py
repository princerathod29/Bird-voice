"""
Core BirdNET AI inference service.
Wraps the official BirdNET neural model using birdnetlib (TFLite runtime with XNNPACK CPU acceleration).
Analyzes audio files, extracts temporal vocalization intervals, ranks species predictions,
and computes soundscape metrics.
"""

import time
import pathlib
import datetime
import sys
from typing import Dict, Any, List, Optional

from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer
from backend.species_info import get_species_info
from backend.audio_analyzer import compute_spectrogram, convert_to_standard_wav

# ai-edge-litert (cp311) does not support resize_tensor_input(); BirdNET model
# has a fixed input shape, so skip resize and keep the loaded tensors.
def _predict_fixed(self, sample, sensitivity=1.0):
    import numpy as np
    import time as _t
    _t0 = _t.time()
    data = np.array([sample], dtype="float32")
    try:
        self.interpreter.resize_tensor_input(
            self.input_layer_index, [len(data), *data[0].shape]
        )
        self.interpreter.allocate_tensors()
    except Exception:
        pass
    self.interpreter.set_tensor(
        self.input_layer_index, np.array(data, dtype="float32")
    )
    self.interpreter.invoke()
    prediction = self.interpreter.get_tensor(self.output_layer_index)
    prediction = self.flat_sigmoid(np.array(prediction), sensitivity=-sensitivity)
    print(f"[service] predict took {_t.time()-_t0:.2f}s", file=sys.stderr, flush=True)
    return prediction

Analyzer.predict = _predict_fixed

# librosa kaiser_fast resampling hangs on low-CPU servers (Render free tier).
# Patch to use fast linear resampling — negligible quality loss for BirdNET.
import librosa as _librosa
_orig_load = _librosa.load
def _fast_load(*args, **kwargs):
    kwargs['res_type'] = 'linear'
    return _orig_load(*args, **kwargs)
_librosa.load = _fast_load

class BirdNetEngine:
    def __init__(self):
        print("Initializing BirdNET Analyzer (TFLite + XNNPACK)...")
        self.analyzer = Analyzer()
        self.version = "BirdNET v2.4 (Cornell Lab of Ornithology & K. Lisa Yang Center for Conservation Bioacoustics)"
        print("BirdNetEngine initialized successfully with official BirdNET models.")

    def run_inference(
        self,
        audio_path: str,
        min_confidence: float = 0.05,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        week: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Runs BirdNET neural network inference on an audio file.
        """
        start_time = time.time()
        
        # 1. Compute acoustic metrics and true STFT spectrogram
        print("[service] run_inference: computing spectrogram", flush=True)
        spectrogram_data = compute_spectrogram(audio_path)
        duration = spectrogram_data.get("duration", 0.0)
        print(f"[service] spectrogram done: {duration}s", flush=True)

        # 2. Setup week parameter if location provided
        curr_week = -1
        if week is not None and 1 <= week <= 52:
            curr_week = min(48, max(1, int(week * 48 / 52)))
        elif latitude is not None and longitude is not None:
            raw_w = datetime.datetime.now().isocalendar()[1]
            curr_week = min(48, max(1, int(raw_w * 48 / 52)))

        # 3. Analyze audio using birdnetlib Recording
        print("[service] creating Recording", flush=True)
        recording = Recording(
            self.analyzer,
            audio_path,
            lat=latitude if latitude is not None and not (latitude == 0 and longitude == 0) else None,
            lon=longitude if longitude is not None and not (latitude == 0 and longitude == 0) else None,
            week_48=curr_week,
            min_conf=max(0.01, min(0.99, min_confidence)),
            return_all_detections=True
        )
        
        print("[service] recording.analyze() start", flush=True)
        recording.analyze()
        print(f"[service] analyze done: {len(recording.detections)} detections", flush=True)
        detections = recording.detections

        # 4. Process and aggregate detections
        species_aggregate: Dict[str, Dict[str, Any]] = {}
        timeline_segments: List[Dict[str, Any]] = []

        # Group detections by time chunk
        chunk_map: Dict[str, List[Dict[str, Any]]] = {}
        for det in detections:
            common = det.get("common_name", "").strip()
            scientific = det.get("scientific_name", "").strip()
            conf = round(float(det.get("confidence", 0.0)), 4)
            st = round(float(det.get("start_time", 0.0)), 2)
            et = round(float(det.get("end_time", 3.0)), 2)
            time_key = f"{st}_{et}"

            if not scientific or not common:
                continue

            # Species aggregate
            if scientific not in species_aggregate:
                species_aggregate[scientific] = {
                    "scientific_name": scientific,
                    "common_name": common,
                    "max_confidence": conf,
                    "occurrences": 1,
                    "time_intervals": [{"start": st, "end": et, "confidence": conf}],
                    "confidence_sum": conf
                }
            else:
                entry = species_aggregate[scientific]
                entry["occurrences"] += 1
                entry["confidence_sum"] += conf
                if conf > entry["max_confidence"]:
                    entry["max_confidence"] = conf
                entry["time_intervals"].append({"start": st, "end": et, "confidence": conf})

            # Timeline chunks
            if time_key not in chunk_map:
                chunk_map[time_key] = []
            chunk_map[time_key].append({
                "scientific_name": scientific,
                "common_name": common,
                "confidence": conf,
                "start": st,
                "end": et
            })

        # Build ordered timeline segments
        for time_key in sorted(chunk_map.keys(), key=lambda k: float(k.split("_")[0])):
            candidates = sorted(chunk_map[time_key], key=lambda x: x["confidence"], reverse=True)
            if candidates:
                best = candidates[0]
                timeline_segments.append({
                    "start": best["start"],
                    "end": best["end"],
                    "top_species": best["common_name"],
                    "scientific_name": best["scientific_name"],
                    "confidence": best["confidence"],
                    "all_candidates": candidates[:4]
                })

        # Rank all species
        ranked_species = sorted(
            species_aggregate.values(),
            key=lambda x: (x["max_confidence"], x["occurrences"]),
            reverse=True
        )

        formatted_predictions = []
        for item in ranked_species:
            meta = get_species_info(item["scientific_name"], item["common_name"])
            avg_conf = round(item["confidence_sum"] / item["occurrences"], 4)
            formatted_predictions.append({
                "scientific_name": item["scientific_name"],
                "common_name": item["common_name"],
                "confidence": item["max_confidence"],
                "avg_confidence": avg_conf,
                "occurrences": item["occurrences"],
                "time_intervals": item["time_intervals"],
                "info": meta
            })

        processing_time = round(time.time() - start_time, 2)
        top_prediction = formatted_predictions[0] if formatted_predictions else None

        # Soundscape diversity score calculation
        detected_count = len(formatted_predictions)
        diversity_score = 0
        if detected_count == 1:
            diversity_score = min(75, int(top_prediction["confidence"] * 75))
        elif detected_count > 1:
            diversity_score = min(100, int(60 + min(35, detected_count * 10) + (top_prediction["confidence"] * 10)))

        return {
            "success": True,
            "duration": duration,
            "processing_time": processing_time,
            "model_version": self.version,
            "species_detected_count": detected_count,
            "soundscape_diversity_score": diversity_score,
            "top_prediction": top_prediction,
            "predictions": formatted_predictions,
            "timeline": timeline_segments,
            "spectrogram": spectrogram_data,
            "location_filtered": bool(latitude is not None and longitude is not None)
        }

# Global singleton engine instance
engine = BirdNetEngine()
