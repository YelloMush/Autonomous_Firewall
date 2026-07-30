# ─────────────────────────────────────────────────────────────────────────────
# Aegis AI Core — Dockerfile
# Build: docker build -t aegis-core:v0.0.1 .
# Run:   docker run -p 8000:8000 --env-file .env aegis-core:v0.0.1
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.10-slim

# Metadata
LABEL maintainer="YelloMush/Autonomous_Firewall"
LABEL version="0.0.1"
LABEL description="Aegis AI Core — Autonomous Network Anomaly Detection & Self-Healing Firewall"

# Set working directory
WORKDIR /app

# ── 1. Install system dependencies (minimal) ──────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Install Python dependencies ───────────────────────────────────────────
# Copy requirements first to leverage Docker layer cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── 3. Copy application source ────────────────────────────────────────────────
COPY core_backend/ ./core_backend/
COPY web_dashboard/ ./web_dashboard/

# ── 4. Environment defaults (override at runtime with --env-file or -e) ───────
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
# AWS creds should be injected at runtime — never baked into the image
ENV AWS_DEFAULT_REGION=ap-south-1

# ── 5. Expose the API port ────────────────────────────────────────────────────
EXPOSE 8000

# ── 6. Healthcheck ────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/system_status')" || exit 1

# ── 7. Entrypoint ─────────────────────────────────────────────────────────────
# Run api_server.py from the core_backend directory so relative imports resolve
WORKDIR /app/core_backend
CMD ["python", "api_server.py"]
