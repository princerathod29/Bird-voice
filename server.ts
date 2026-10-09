/**
 * BirdVoice AI - Server Entry Point
 * Express server with Vite middleware integration in dev mode,
 * bioacoustic audio processing endpoints, and real BirdNET model execution.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';

// Resolve Python interpreter: prefer project venv (has birdnetlib/tflite deps)
const venvPython = path.join(__dirname, '.venv', 'bin', 'python3');
const PYTHON_BIN =
  process.env.PYTHON_BIN || (fs.existsSync(venvPython) ? venvPython : 'python3');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS: allow cross-origin API calls (e.g. Vercel frontend -> Render backend)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Storage for uploaded audio recordings
const uploadDir = path.join(__dirname, 'tmp_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.wav';
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(wav|mp3|m4a|ogg|flac|webm|aac)$/i;
    if (allowed.test(file.originalname) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported audio format. Please upload WAV, MP3, M4A, OGG, FLAC, or WEBM.'));
    }
  },
});

// Samples catalog
const SAMPLES = [
  {
    id: 'robin',
    name: 'European Robin (Song)',
    species: 'Erithacus rubecula',
    common_name: 'European Robin',
    duration: 7.0,
    description: 'Rich liquid warble recorded in temperate woodland habitat. Highly territorial song with rapid pitch changes.',
    audio_url: '/api/samples/robin/audio',
    sample_file: 'robin.mp3'
  },
  {
    id: 'cardinal',
    name: 'Northern Cardinal (Whistle)',
    species: 'Cardinalis cardinalis',
    common_name: 'Northern Cardinal',
    duration: 7.0,
    description: 'Clear resonant whistle notes followed by rapid trill recorded in Massachusetts, USA.',
    audio_url: '/api/samples/cardinal/audio',
    sample_file: 'cardinal.mp3'
  },
  {
    id: 'koel',
    name: 'Asian Koel (Breeding Call)',
    species: 'Eudynamys scolopaceus',
    common_name: 'Asian Koel',
    duration: 6.5,
    description: "Loud repetitive 'ko-el' breeding crescendo recorded in tropical canopy.",
    audio_url: '/api/samples/koel/audio',
    sample_file: 'koel.mp3'
  }
];

// Helper: Run Python BirdNET inference script
function runBirdNetInference(
  audioFilePath: string,
  minConfidence = 0.05,
  lat?: number,
  lon?: number,
  week?: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pyScript = path.join(__dirname, 'backend', 'run_inference.py');

    const args = [pyScript, audioFilePath, '--min-confidence', minConfidence.toString()];
    if (lat !== undefined && !isNaN(lat)) args.push('--lat', lat.toString());
    if (lon !== undefined && !isNaN(lon)) args.push('--lon', lon.toString());
    if (week !== undefined && !isNaN(week)) args.push('--week', week.toString());

    const env = {
      ...process.env,
      TF_CPP_MIN_LOG_LEVEL: '3',
      TF_ENABLE_ONEDNN_OPTS: '0',
    };

    const pyProcess = spawn(PYTHON_BIN, args, { env, cwd: __dirname, timeout: 120000 });

    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    pyProcess.on('close', (code) => {
      const startTag = '__BIRDNET_RESULT_JSON_START__';
      const endTag = '__BIRDNET_RESULT_JSON_END__';
      const sIdx = stdoutData.indexOf(startTag);
      const eIdx = stdoutData.indexOf(endTag);

      let parsed: any = null;
      if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
        const jsonStr = stdoutData.substring(sIdx + startTag.length, eIdx).trim();
        try {
          parsed = JSON.parse(jsonStr);
        } catch (err: any) {
          console.error('JSON parse error from BirdNET output:', err);
        }
      }

      if (parsed) {
        if (parsed.success === false) {
          reject(new Error(parsed.error || 'BirdNET inference failed'));
        } else {
          resolve(parsed);
        }
      } else {
        const errorMsg = stderrData || stdoutData || `Python exited with code ${code}`;
        reject(new Error(`Failed to parse BirdNET output: ${errorMsg}`));
      }
    });

    pyProcess.on('error', (err) => {
      reject(new Error(`Failed to launch Python BirdNET process: ${err.message}`));
    });
  });
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    birdnet: true,
    model: 'BirdNET v2.4 (Cornell Lab of Ornithology)',
    species_catalog_count: 6521,
    inference_engine: 'TensorFlow Lite + XNNPACK',
    audio_formats_supported: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'webm']
  });
});

// Debug: test Python imports and BirdNET engine init
app.get('/api/debug/python', async (_req: Request, res: Response) => {
  const pyScript = `
import json, sys, traceback
try:
    from ai_edge_litert import interpreter
    print("ai_edge_litert OK", file=sys.stderr)
    import tflite_runtime.interpreter as tflite
    print("tflite_runtime shim OK", file=sys.stderr)
    from birdnetlib.analyzer import Analyzer
    print("birdnetlib.analyzer import OK", file=sys.stderr)
    a = Analyzer()
    print("Analyzer() init OK", file=sys.stderr)
    print(json.dumps({"status": "ok", "ai_edge_litert": True, "tflite_runtime": True, "analyzer": True}))
except Exception as e:
    print(json.dumps({"status": "error", "error": str(e), "trace": traceback.format_exc()}))
    sys.exit(1)
  `;
  
  const py = spawn(PYTHON_BIN, ['-c', pyScript], { cwd: __dirname, timeout: 60000 });
  let stdoutData = '';
  let stderrData = '';
  
  py.stdout.on('data', (d) => stdoutData += d.toString());
  py.stderr.on('data', (d) => stderrData += d.toString());
  
  py.on('close', (code) => {
    try {
      const lastLine = stdoutData.trim().split('\n').pop() || '';
      const parsed = JSON.parse(lastLine);
      if (code === 0 && parsed.status === 'ok') {
        res.json({ success: true, ...parsed, stderr: stderrData.trim().split('\n').slice(-5) });
      } else {
        res.status(500).json({ success: false, ...parsed, stderr: stderrData.trim().split('\n').slice(-10), code });
      }
    } catch {
      res.status(500).json({ success: false, error: 'Failed to parse debug output', stdout: stdoutData.slice(-500), stderr: stderrData.slice(-500), code });
    }
  });
  
  py.on('error', (err) => {
    res.status(500).json({ success: false, error: `Spawn failed: ${err.message}` });
  });
});

// Debug: test model load only
app.get('/api/debug/test-meta', async (_req: Request, res: Response) => {
  const pyScript = `
import json, sys, traceback, time, pathlib
sys.path.insert(0, '${__dirname.replace(/'/g, "\\'")}')
try:
    from ai_edge_litert import interpreter
    import tflite_runtime.interpreter as tflite
    from birdnetlib.analyzer import Analyzer
    
    t0 = time.time()
    a = Analyzer()
    print(f"Analyzer init: {time.time()-t0:.2f}s", file=sys.stderr)
    
    # Force model load
    t1 = time.time()
    a.load_model()
    print(f"Main model load: {time.time()-t1:.2f}s", file=sys.stderr)
    
    # Test interpreter
    t2 = time.time()
    print(f"Input details: {a.input_details}", file=sys.stderr)
    print(f"Output details: {a.output_details}", file=sys.stderr)
    
    print(json.dumps({"success": True, "total": time.time()-t0}))
except Exception as e:
    import traceback
    print(json.dumps({"success": False, "error": str(e), "trace": traceback.format_exc()}))
    sys.exit(1)
  `;
  
  const py = spawn(PYTHON_BIN, ['-c', pyScript], { cwd: __dirname, timeout: 120000 });
  let stdoutData = '';
  let stderrData = '';
  
  py.stdout.on('data', (d) => stdoutData += d.toString());
  py.stderr.on('data', (d) => stderrData += d.toString());
  
  py.on('close', (code) => {
    try {
      const lastLine = stdoutData.trim().split('\n').pop() || '';
      const parsed = JSON.parse(lastLine);
      res.json({ ...parsed, stderr: stderrData.trim().split('\n').slice(-10), code });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to parse', stdout: stdoutData.slice(-500), stderr: stderrData.slice(-500), code });
    }
  });
});

// Samples list
app.get('/api/samples', (_req: Request, res: Response) => {
  res.json({ samples: SAMPLES });
});

// Sample audio stream
app.get('/api/samples/:id/audio', (req: Request, res: Response) => {
  const sampleId = req.params.id;
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!sample) {
    return res.status(404).json({ error: 'Sample not found' });
  }

  const sampleDir = path.join(__dirname, 'public', 'samples');
  for (const ext of ['mp3', 'wav', 'ogg']) {
    const filePath = path.join(sampleDir, `${sampleId}.${ext}`);
    if (fs.existsSync(filePath)) {
      const mime = ext === 'mp3' ? 'audio/mpeg' : (ext === 'wav' ? 'audio/wav' : 'audio/ogg');
      res.setHeader('Content-Type', mime);
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  res.status(404).json({ error: `Audio file for sample ${sampleId} not found` });
});

// Species information endpoint
app.get('/api/species/:scientificName', async (req: Request, res: Response) => {
  const sciName = decodeURIComponent(req.params.scientificName);
  const commonName = req.query.common_name ? String(req.query.common_name) : undefined;
  
  const pyScript = `
import json, sys
sys.path.insert(0, '${__dirname}')
from backend.species_info import get_species_info
info = get_species_info('${sciName.replace(/'/g, "\\'")}', '${(commonName || sciName).replace(/'/g, "\\'")}')
print(json.dumps(info))
`;
  
  const py = spawn(PYTHON_BIN, ['-c', pyScript], { cwd: __dirname });
  let out = '';
  py.stdout.on('data', (d) => { out += d.toString(); });
  py.on('close', () => {
    try {
      res.json(JSON.parse(out.trim()));
    } catch {
      res.json({
        scientific_name: sciName,
        common_name: commonName || sciName,
        description: `Avian vocalizer documented in the BirdNET bioacoustic archive.`
      });
    }
  });
});

// Audio analysis endpoint
app.post('/api/analyze', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided in request.' });
  }

  const uploadedPath = req.file.path;
  const minConfidence = req.body.min_confidence ? parseFloat(req.body.min_confidence) : 0.05;
  const latitude = req.body.latitude ? parseFloat(req.body.latitude) : undefined;
  const longitude = req.body.longitude ? parseFloat(req.body.longitude) : undefined;
  const week = req.body.week ? parseInt(req.body.week, 10) : undefined;

  try {
    const analysisResult = await runBirdNetInference(
      uploadedPath,
      minConfidence,
      latitude,
      longitude,
      week
    );
    res.json(analysisResult);
  } catch (error: any) {
    console.error('Inference error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error occurred during BirdNET neural analysis'
    });
  } finally {
    // Delete temporary upload safely
    if (fs.existsSync(uploadedPath)) {
      try {
        fs.unlinkSync(uploadedPath);
      } catch (err) {
        console.error('Failed to unlink uploaded temp file:', err);
      }
    }
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Server
// -------------------------------------------------------------

async function startServer() {
  if (IS_DEV) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BirdVoice AI server listening on http://0.0.0.0:${PORT} (${IS_DEV ? 'development' : 'production'})`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failure:', err);
  process.exit(1);
});
