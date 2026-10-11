# ---- 1. build the React app ----
FROM node:24-alpine AS web
WORKDIR /srv/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- 2. FastAPI runtime serving API + WebSocket + static build ----
FROM python:3.12-slim
WORKDIR /srv/api
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATABASE_URL=sqlite:////tmp/tandem.db
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/app ./app
COPY --from=web /srv/web/dist /srv/web/dist
RUN useradd -r app && chown -R app /srv
USER app
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]
