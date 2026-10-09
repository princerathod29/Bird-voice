export interface TimeInterval {
  start: number;
  end: number;
  confidence: number;
}

export interface VocalizationInfo {
  type: string;
  frequency_range: string;
  characteristics: string;
}

export interface SpeciesProfile {
  common_name: string;
  scientific_name: string;
  family: string;
  order: string;
  iucn_status: string;
  description: string;
  habitat: string;
  geographic_range: string;
  vocalizations: VocalizationInfo;
  diet: string;
  wingspan: string;
  fun_fact: string;
}

export interface SpeciesPrediction {
  scientific_name: string;
  common_name: string;
  confidence: number;
  avg_confidence: number;
  occurrences: number;
  time_intervals: TimeInterval[];
  regional_match?: boolean;
  info: SpeciesProfile;
}

export interface TimelineSegment {
  start: number;
  end: number;
  top_species: string;
  scientific_name: string;
  confidence: number;
  all_candidates: Array<{
    scientific_name: string;
    common_name: string;
    confidence: number;
  }>;
}

export interface SpectrogramData {
  duration: number;
  sample_rate: number;
  rms: number;
  peak: number;
  time_bins: number;
  freq_bins: number;
  max_frequency_khz: number;
  grid: number[][];
}

export interface AudioQualityInfo {
  rms: number;
  peak: number;
  snr_db?: number;
  is_quiet: boolean;
  is_clipping: boolean;
  is_noisy: boolean;
  filter_applied: boolean;
  warnings: string[];
  duration?: number;
}

export type OneTapRecordingState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'processing'
  | 'success'
  | 'no_detection'
  | 'error';

export interface AnalysisResponse {
  success: boolean;
  duration: number;
  processing_time: number;
  model_version: string;
  species_detected_count: number;
  soundscape_diversity_score: number;
  top_prediction: SpeciesPrediction | null;
  predictions: SpeciesPrediction[];
  timeline: TimelineSegment[];
  spectrogram: SpectrogramData;
  location_filtered: boolean;
  audio_quality?: AudioQualityInfo;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  duration: number;
  topSpecies: string;
  scientificName: string;
  confidence: number;
  audioBlobUrl?: string;
  audioFileName?: string;
  diversityScore: number;
  predictionsCount: number;
  response: AnalysisResponse;
}

export interface SampleRecording {
  id: string;
  name: string;
  species: string;
  common_name: string;
  duration: number;
  description: string;
  audio_url: string;
  sample_file: string;
}
