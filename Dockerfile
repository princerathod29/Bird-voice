FROM node:24-bookworm

RUN apt-get update && apt-get install -y python3 python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir -r requirements.txt \
    && .venv/bin/pip install --no-cache-dir audioop-lts audioread ai-edge-litert imageio-ffmpeg

RUN SP=$(.venv/bin/python3 -c "import site;print(site.getsitepackages()[0])") \
    && mkdir -p "$SP/tflite_runtime" \
    && printf 'from ai_edge_litert import interpreter as _i\nimport sys\nsys.modules[__name__ + ".interpreter"] = _i\nfrom ai_edge_litert import interpreter\n' > "$SP/tflite_runtime/__init__.py"

ENV PYTHON_BIN=/app/.venv/bin/python3
EXPOSE 3000

CMD ["npm", "run", "dev"]
