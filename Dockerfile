FROM node:24-bookworm

RUN apt-get update && apt-get install -y python3 python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir --upgrade pip \
    && .venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PYTHON_BIN=/app/.venv/bin/python3
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
