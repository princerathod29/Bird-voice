# BirdVoice AI — Agent Guidelines & Execution Policy

## 1. Autonomous Execution
* Execute all routine development tasks, package management, build checks, and server commands (`npm`, `tsx`, `node`, `python3`, `ffmpeg`, `git`) directly without asking for repetitive manual user approval in chat.
* Maintain momentum and verify results through direct checks (e.g. `curl http://localhost:3000/api/health`, `npm run lint`, `npm run build`).

## 2. Essential Security Guardrails
* **No Privilege Escalation**: Never execute `sudo` or destructive system commands (`dd`, `mkfs`, `reboot`, `shutdown`).
* **Boundary Confinement**: Strictly operate within the project workspace (`/home/shubham/Bird-Sound-AI`). Do not read or modify files in `~/.ssh/`, `~/.aws/`, `~/.gnupg/`, or `/etc/`.
* **Safe File Management**: Avoid broad recursive deletions (`rm -rf *`). Clean only project-specific temporary artifacts (e.g. `tmp_uploads/`, `dist/`).

## 3. Project Architecture
* **Frontend**: React 19 + Vite with Tailwind CSS. One-tap 6-second bioacoustic recording flow via `useBirdRecorder` with raw WebRTC capture (speech noise suppression disabled).
* **Backend**: Express server (`server.ts`) running bioacoustic inference on `http://localhost:3000`.
* **Neural Engine**: Official Cornell Lab BirdNET v2.4 running via local Python `.venv/bin/python3 backend/run_inference.py` with 50% sliding-window overlap (`overlap=1.5`) and local geographic range prioritization.
* **Audio Preprocessing**: Standardized 48 kHz mono 16-bit PCM WAV, 250 Hz high-pass Butterworth DSP filter to suppress outdoor wind/traffic rumble, and up to 25x adaptive peak normalization (target 0.75).
