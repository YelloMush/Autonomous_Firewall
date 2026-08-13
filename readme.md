# 🛡️ Project Aegis
### Enterprise-Grade Reverse Proxy Firewall — Autonomous AI Threat Mitigation
> 5th Semester Computer Science — Cloud Computing & AI Security Project

---

## 📌 Overview

Project Aegis is a **B2B Firewall-as-a-Service (FWaaS)** built on the **Model A: Reverse Proxy Shield** architecture — similar to how Cloudflare protects enterprise infrastructure. Clients update a single DNS record; Aegis routes all their traffic through massive cloud buffers, evaluates every request using an unsupervised Machine Learning model, and delivers only clean traffic to the client's origin server.

The system demonstrates a complete **DNS → SQS Buffer → AI Cleanser → VPC NACL → Origin** pipeline, with a production-ready React web UI, a FastAPI tenant control plane, and an interactive live attack simulation dashboard.

---

## 🏗️ Architecture — Model A (Reverse Proxy Shield)

```
                         CLIENT DNS UPDATE
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      OPEN INTERNET                               │
│           (Legitimate traffic + DDoS attack traffic)             │
└───────────────────────────┬──────────────────────────────────────┘
                            │  Anycast DNS routes ALL traffic here
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  AEGIS CLOUD SHIELD (Edge)                       │
│                                                                  │
│  ┌─────────────────┐      ┌──────────────────────────────────┐  │
│  │   Aegis Edge    │      │       Amazon SQS Buffer          │  │
│  │   Ingress IP    │─────▶│   (Absorbs volumetric spikes)    │  │
│  │  (Anycast)      │      │   Aegis-Ingestion-Queue          │  │
│  └─────────────────┘      └──────────────┬───────────────────┘  │
│                                          │                       │
│                                          ▼                       │
│                           ┌─────────────────────────────────┐   │
│                           │     AI Core — api_server.py     │   │
│                           │  Isolation Forest (sklearn)     │   │
│                           │  10s sliding window · 5 features│   │
│                           └──────────────┬──────────────────┘   │
│                                          │ Anomaly Detected      │
│                                          ▼                       │
│                           ┌─────────────────────────────────┐   │
│                           │    Cloud Circuit Breaker        │   │
│                           │  boto3 → VPC NACL DENY rules    │   │
│                           │  Priority-99 · All protocols    │   │
│                           └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                            │  Only CLEAN traffic forwarded
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              CLIENT ORIGIN SERVER (VPC / EC2)                    │
│         Stable ~400 req/s — never sees the attack                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Components

### Core Backend (`core_backend/`)

| File | Port | Role |
|------|------|------|
| `api_server.py` | `8000` | FastAPI AI Core. Async-polls SQS, runs Isolation Forest inference, triggers circuit breaker. Handles PBKDF2 user authentication and serves the web UI/Desktop Client endpoints. |
| `tenant_api.py` | `8001` | **NEW** — FastAPI Tenant Control Plane. Handles onboarding: provisions Nginx reverse proxy config, assigns ingress IPs, simulates DNS verification polling. |
| `analytics_engine.py` | — | Scikit-Learn `IsolationForest` model. 10-second sliding window over 5 traffic features. |

### Web Frontend (`web_dashboard/`)

| File | Role |
|------|------|
| `pitch.html` | **Full React SPA** — Anthropic-inspired landing page + 3-step tenant onboarding flow + live Tenant Dashboard with attack simulation. |

### AWS Infrastructure (`aws_infrastructure/`)

| File | Role |
|------|------|
| `aegis_launch.py` | One-click launcher — provisions EC2, uploads sniffer, opens all service terminals. |
| `redeploy_sensor.py` | Provisions a fresh EC2 instance, rotates SSH key pair. |
| `reset_nacl.py` | Removes the NACL DENY rule after a demo for a clean re-run. |
| `cleanup.py` | Stops EC2 and purges SQS to minimize AWS costs when idle. |
| `check_instance.py` | Shows current EC2 instance state and public IP. |

### Edge Sensor (`edge_sensor/`)

| File | Role |
|------|------|
| `cloud_sniffer.py` | Runs on EC2. Intercepts raw packets using `scapy` and pushes JSON telemetry to SQS. |

### Tools & Tests (`tools_and_tests/`)

| File | Role |
|------|------|
| `simulate_attack.py` | Tkinter desktop dashboard to monitor the system and trigger volumetric attacks locally. |
| `live_db_monitor.py` | Real-time terminal monitor showing live packet ingestion and threat isolation events. |

---

## 🌐 Web UI & Tenant Dashboard

The primary interface is a **React single-page application** served at `http://localhost:8000/pitch.html`.

### Application Flow

```
Landing Page → Sign In (modal) → Get Protected (Onboarding) → DNS Verified → Dashboard
```

### Landing Page
- Anthropic-inspired minimalist design (stone-50 background, serif/sans-serif typography)
- Interactive traffic simulation showing the Aegis reverse proxy absorbing a DDoS attack in real time
- "How It Works" section explaining the 4-step Model A pipeline

### Onboarding Flow (3 Steps)
1. **Domain Verification** — Enter domain → `POST /api/provision-tenant` → receives `tenant_id`, `ingress_ip`, `cname_target`
2. **DNS Configuration** — Displays the exact CNAME record to add in the client's DNS provider
3. **Deployment** — Polls `GET /api/check-dns/{tenant_id}` every 3 seconds → auto-redirects to Dashboard on verification

### Tenant Dashboard (Live Telemetry)
Three animated metric cards update in real time at 120ms intervals:

| Metric | Nominal | Under Attack | After Mitigation |
|--------|---------|-------------|-----------------|
| **Edge Ingestion Rate** | ~375 req/s | ~87,000 req/s | ~400 req/s |
| **AI Anomaly Score** | ~0.15 / 1.00 | **0.92** (threshold breached) | ~0.15 |
| **Origin Server Load** | ~375 req/s | ~570 req/s (barely moves) | ~400 req/s |

### Attack Simulation (3 Phases)

| Phase | Duration | Trigger |
|-------|----------|---------|
| **Nominal Baseline** | Continuous | On dashboard load |
| **Volumetric Breach** | 3 seconds | "Launch Volumetric Attack" button |
| **Autonomous Mitigation** | Ongoing | Auto-triggered after 3s breach |

During mitigation, a **Boto3 NACL Rules table** appears showing the injected IP block rules — directly storytelling the AWS infrastructure response.

---

## ⚙️ How the AI Works

### Phase 1 — Calibration (20 seconds)
On startup, `api_server.py` samples traffic every second using a 10-second sliding window to build a baseline dataset with 5 features:
- `packet_count`, `total_bytes`, `packet_rate`, `byte_rate`, Shannon entropy

If fewer than 12 real samples are collected (quiet network), synthetic baselines are injected so the Isolation Forest has a proper decision boundary.

### Phase 2 — Live Anomaly Detection
- If `packet_count > 1.5× baseline average` → run `IsolationForest.predict()`
- If prediction is **`-1`** (anomaly) → trigger circuit breaker
- If spike is **`> 10× baseline`** (hard override) → bypass model, force trigger
  *(Defends against Training Data Poisoning where calibration was contaminated)*

### Phase 3 — Autonomous Response
Upon anomaly detection, `api_server.py` uses `boto3` to:
1. Inject a **Priority-99 DENY ALL** rule into the VPC Network ACL (ingress + egress)
2. Log the block event to SQLite (`firewall_logs.db`)
3. Update the live dashboard

**The VPC is completely isolated from the internet with zero human intervention.**

---

## 🚀 Running the Full Stack

### Prerequisites

```bash
pip install -r requirements.txt
```

Set AWS credentials *(run once in PowerShell, then restart terminals)*:
```powershell
[System.Environment]::SetEnvironmentVariable("AWS_ACCESS_KEY_ID","<YOUR_KEY>","User")
[System.Environment]::SetEnvironmentVariable("AWS_SECRET_ACCESS_KEY","<YOUR_SECRET>","User")
[System.Environment]::SetEnvironmentVariable("AWS_DEFAULT_REGION","ap-south-1","User")
```

---

### Start the Backend Servers

Open two separate terminals and run:

```powershell
# Terminal 1 — AI Core + Web Server (Port 8000)
python core_backend/api_server.py

# Terminal 2 — Tenant Control Plane (Port 8001)
python core_backend/tenant_api.py
```

Then open the web UI:
```
http://localhost:8000/pitch.html
```

---

### Full AWS Demo (EC2 + SQS)

**Step 1 — Provision the Edge Sensor** *(first time or after termination)*
```powershell
python aws_infrastructure\redeploy_sensor.py
```
- Terminates any old EC2 instance
- Rotates the SSH key pair (`aegis_edge_key.pem`)
- Launches a fresh `t3.micro` Amazon Linux 2023 instance
- Saves the new public IP to `aws_infrastructure\aegis_config.txt`

**Step 2 — One-Click Launch** *(run every time)*
```powershell
python aws_infrastructure\aegis_launch.py
```
Automatically:
1. Locks down SSH key file permissions
2. Opens port 22 on the EC2 Security Group
3. Uploads and starts `cloud_sniffer.py` on EC2 in a background `tmux` session
4. Purges the SQS queue for a clean calibration
5. Opens three service terminals: AI Core, Live Monitor, Attack Dashboard

**Step 3 — Wait for AI Calibration (~20 seconds)**
```
==========================================
PHASE 2: CALIBRATION COMPLETE. AI IS NOW ARMED.
[*] Anomaly threshold: > X packets / 10s window
==========================================
```

**Step 4 — Trigger the Circuit Breaker**
1. Open the **Aegis Attack Dashboard** (Tkinter window) or use the web UI
2. Click **Launch Volumetric Attack**
3. The AI Core terminal will show:
```
[AI] SPIKE DETECTED (60 pkts > threshold 7.5)
[AI] HARD OVERRIDE: Spike is 8x baseline — forcing anomaly
INITIATING CLOUD CIRCUIT BREAKER
[+] SUCCESS: VPC NACL Lockdown Engaged.
```

**Step 5 — Reset for Another Run**
```powershell
python aws_infrastructure\reset_nacl.py
```

**Step 6 — Shutdown** *(minimize AWS costs)*
```powershell
python aws_infrastructure\cleanup.py
```

---

## 🐳 Docker (AI Core)

A `Dockerfile` is included to containerize `api_server.py` for environment-agnostic deployment:

```bash
# Build the image
docker build -t aegis-core .

# Run the container
docker run -p 8000:8000 \
  -e AWS_ACCESS_KEY_ID=<key> \
  -e AWS_SECRET_ACCESS_KEY=<secret> \
  -e AWS_DEFAULT_REGION=ap-south-1 \
  aegis-core
```

> Requires Docker Desktop. Install via: `choco install docker-desktop -y` (as Administrator)

---

## 📦 Desktop Client Installer (Windows, no Python required)

`desktop_client` can be packaged into a standalone Windows installer that end users can just download and run — the AI Core and load-tester are frozen into `.exe`s with PyInstaller, so the installed app has **no dependency on a system Python install**.

```powershell
pip install pyinstaller pyinstaller-hooks-contrib
python packaging/build_installer.py
```

This freezes `core_backend/api_server.py` and `tests/real_world_tester.py` into `packaging/backend_dist/`, then runs `electron-builder` to produce:

```
desktop_client/release/Aegis Enterprise Setup <version>.exe
```

Double-clicking that installer sets up the app; on launch it spawns its own bundled backend (`resources/backend/api_server.exe`) instead of shelling out to `python`. The SQLite user/traffic database lives under `%LOCALAPPDATA%\Aegis\` for the packaged build (vs. next to `api_server.py` when run from source).

> Rebuild the installer any time `core_backend/`, `tests/real_world_tester.py`, or `desktop_client/` change — `packaging/backend_dist/` and `desktop_client/release/` are build output, not source, and aren't committed.

---

## 🧠 AI Model Reference

| Parameter | Value |
|-----------|-------|
| Algorithm | `sklearn.ensemble.IsolationForest` |
| Contamination | `0.01` (1% anomaly expectation in training data) |
| Feature Vector | `[packet_count, total_bytes, packet_rate, byte_rate, entropy]` |
| Window Size | 10 seconds (sliding) |
| Calibration Period | 20 seconds on startup |
| Soft Threshold | `> 1.5×` calibrated baseline average |
| Hard Override | `> 10×` baseline (bypasses model — defends against data poisoning) |

---

## 🔌 API Reference

### AI Core — `http://localhost:8000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pitch.html` | `GET` | Serves the React web UI |
| `/download` | `GET` | Serves the Desktop Client download page |
| `/ws/live` | `WebSocket` | Live telemetry stream for dashboard |
| `/api/auth/signup` | `POST` | User registration (shared between web and desktop) |
| `/api/auth/login` | `POST` | User authentication (PBKDF2 hashed) |
| `/api/auth/lookup` | `GET` | Checks if an email is registered |

### Tenant Control Plane — `http://localhost:8001`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/provision-tenant` | `POST` | Accepts `{domain_name}`. Generates `tenant_id`, assigns ingress IP, renders Nginx config. **Idempotent.** |
| `/api/check-dns/{tenant_id}` | `GET` | Returns `{status: "pending"}` or `{status: "verified"}` after 10s elapsed. |
| `/api/tenants` | `GET` | Dev-only: lists all provisioned tenants. |
| `/docs` | `GET` | Auto-generated Swagger UI (port 8001). |

---

## ☁️ AWS Infrastructure

| Resource | Detail |
|----------|--------|
| Region | `ap-south-1` (Mumbai) |
| EC2 Instance Type | `t3.micro` — Amazon Linux 2023 |
| SQS Queue | `Aegis-Ingestion-Queue` (Standard Queue) |
| VPC ID | `vpc-003c74ae5acdd10b9` |
| Subnet ID | `subnet-0bee2bd317be72849` |
| NACL ID | `acl-0f6ba5dd5e1a1657c` ← Circuit Breaker target |

---

## 🔒 Security Notes

> **The following files are excluded from this repository via `.gitignore`:**
> - `aws_infrastructure/aegis_edge_key.pem` — SSH private key (rotated on each deploy)
> - `core_backend/firewall_logs.db` — SQLite runtime database
> - `CLOUD_IMPLEMENTATION.txt` — Internal architecture notes

Never commit AWS credentials or private keys to a public repository.

---

## 📦 Dependencies

```
fastapi      — REST API framework for the AI Core and Tenant Control Plane
uvicorn      — ASGI server for FastAPI
boto3        — AWS SDK (EC2, SQS, NACL management)
scapy        — Raw packet capture on the EC2 Linux sensor
scikit-learn — IsolationForest anomaly detection model
pandas       — Feature extraction and windowed traffic analysis
numpy        — Mathematical operations for entropy calculation
requests     — HTTP communication between components
```

```bash
pip install -r requirements.txt
```

---

## 🌿 Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases |
| `user-interface-updates` | Active development — Model A UI, Tenant Dashboard, Control Plane |

Current active release: **`v0.0.1`** — First public user-testing build.
