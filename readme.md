# 🛡️ Project Aegis
### Autonomous AI-Driven Self-Healing Cloud Firewall
> 5th Semester Computer Science — Cloud Computing & AI Security Project

---

## 📌 Overview

Project Aegis is a **distributed, cloud-native autonomous firewall** that uses machine learning to detect volumetric DDoS attacks in real-time and automatically isolates the compromised AWS network infrastructure — without any human intervention.

The system demonstrates a complete **Edge → Cloud → AI → Response** pipeline across AWS EC2, Amazon SQS, Python FastAPI, and Scikit-Learn's Isolation Forest.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROJECT AEGIS                            │
│                                                                 │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │  EC2 Edge   │     │  Amazon SQS  │     │   AI Core       │  │
│  │  Sensor     │────▶│  Ingestion   │────▶│   (Local PC)    │  │
│  │             │     │  Queue       │     │                 │  │
│  │ cloud_      │     │              │     │ api_server.py   │  │
│  │ sniffer.py  │     │ Aegis-       │     │ + Isolation     │  │
│  │             │     │ Ingestion-   │     │   Forest        │  │
│  │ [scapy]     │     │ Queue        │     │                 │  │
│  └─────────────┘     └──────────────┘     └────────┬────────┘  │
│                                                    │           │
│                                           Anomaly  │ Detected  │
│                                                    ▼           │
│                                           ┌─────────────────┐  │
│                                           │  Cloud Circuit  │  │
│                                           │  Breaker        │  │
│                                           │                 │  │
│                                           │  boto3 injects  │  │
│                                           │  Priority-99    │  │
│                                           │  DENY ALL rule  │  │
│                                           │  → VPC NACL     │  │
│                                           └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Components

| File | Location | Role |
|------|----------|------|
| `cloud_sniffer.py` | `edge_sensor/` | Runs on EC2. Intercepts raw packets using `scapy` and pushes JSON telemetry to SQS |
| `api_server.py` | `core_backend/` | FastAPI backend. Async-polls SQS, feeds AI engine, triggers circuit breaker |
| `analytics_engine.py` | `core_backend/` | Scikit-Learn `IsolationForest` model with 10-second sliding window |
| `simulate_attack.py` | `tools_and_tests/` | Tkinter dashboard to monitor the system and simulate volumetric attacks |
| `live_db_monitor.py` | `tools_and_tests/` | Real-time terminal monitor showing live packet ingestion and threat isolation |
| `aegis_launch.py` | `aws_infrastructure/` | **One-click launcher** — handles all setup and opens all service windows |
| `redeploy_sensor.py` | `aws_infrastructure/` | Provisions a fresh EC2 instance and rotates the SSH key pair |
| `reset_nacl.py` | `aws_infrastructure/` | Removes the NACL block rule after a demo so the circuit breaker can be re-triggered |
| `cleanup.py` | `aws_infrastructure/` | Stops EC2 and purges SQS to minimise AWS costs when not in use |
| `check_instance.py` | `aws_infrastructure/` | Shows current EC2 instance state and public IP |

---

## ⚙️ How It Works

### Phase 1 — AI Calibration (20 seconds)
When `api_server.py` starts, it enters a 20-second calibration window. It samples incoming traffic statistics every second using a 10-second sliding window, recording:
- `packet_count`, `total_bytes`, `packet_rate`, `byte_rate`, Shannon entropy

These samples form the **baseline dataset** the Isolation Forest trains on.
If fewer than 12 real samples are collected (quiet network), diverse synthetic baselines are injected so the model has a proper decision boundary.

### Phase 2 — Live Anomaly Detection
The trained model continuously evaluates incoming traffic:
- If `packet_count > 1.5× baseline average` → run `IsolationForest.predict()`
- If prediction is **`-1`** (anomaly) → trigger circuit breaker
- If spike is **`> 10× baseline`** (hard override) → bypass model, force trigger  
  *(This protects against Training Data Poisoning where calibration was contaminated)*

### Phase 3 — Autonomous Response (Cloud Circuit Breaker)
Upon detecting an anomaly, `api_server.py` uses `boto3` to:
1. Inject a **Priority-99 DENY ALL** rule into the VPC Network ACL (ingress + egress)
2. Log the block event to SQLite
3. Update the live dashboard counter from 0 → 1

**The VPC is completely isolated from the internet with zero human intervention.**

---

## 🚀 How to Run

### Prerequisites

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Set AWS credentials permanently **(run once in PowerShell, then restart terminals):**
```powershell
[System.Environment]::SetEnvironmentVariable("AWS_ACCESS_KEY_ID","<YOUR_KEY>","User")
[System.Environment]::SetEnvironmentVariable("AWS_SECRET_ACCESS_KEY","<YOUR_SECRET>","User")
[System.Environment]::SetEnvironmentVariable("AWS_DEFAULT_REGION","ap-south-1","User")
```

---

### Step 1 — Provision the Edge Sensor *(first time or after termination)*
```powershell
python aws_infrastructure\redeploy_sensor.py
```
This will:
- Terminate any old EC2 instance
- Rotate the SSH key pair (`aegis_edge_key.pem`)
- Launch a fresh `t3.micro` Amazon Linux 2023 instance
- Wait for it to reach "running" state
- Save the new public IP to `aws_infrastructure\aegis_config.txt`

---

### Step 2 — One-Click Launch *(run this every time)*
```powershell
python aws_infrastructure\aegis_launch.py
```
This automatically:
1. Locks down SSH key file permissions
2. Opens port 22 on the EC2 Security Group
3. Waits for EC2 to be SSH-ready (up to 100 seconds)
4. Uploads and starts `cloud_sniffer.py` on EC2 in a background `tmux` session
5. Purges the SQS queue for a clean calibration
6. Opens three separate terminal windows:
   - 🧠 **Aegis AI Core** (`api_server.py`)
   - 📊 **Aegis Live Monitor** (`live_db_monitor.py`)
   - ⚔️  **Aegis Attack Dashboard** (`simulate_attack.py`)

> **Note:** If EC2 SSH is unreachable, the launcher gracefully skips the EC2 steps and opens local services. The full circuit breaker demo still works via local HTTP injection.

---

### Step 3 — Watch the AI Arm Itself
In the **Aegis AI Core** terminal, wait ~20 seconds until you see:
```
==========================================
PHASE 2: CALIBRATION COMPLETE. AI IS NOW ARMED.
[*] Anomaly threshold: > X packets / 10s window
==========================================
```

---

### Step 4 — Demo the Circuit Breaker
1. Open the **Aegis Attack Dashboard** (Tkinter window)
2. Click **⚡ LAUNCH VOLUMETRIC ATTACK**
3. Watch the AI Core terminal:
```
[AI] 🛑 SPIKE DETECTED (60 pkts > threshold 7.5)
[AI] ⚡ HARD OVERRIDE: Spike is 8× baseline — forcing anomaly
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
🚨  INITIATING CLOUD CIRCUIT BREAKER  🚨
[+] SUCCESS: VPC NACL Lockdown Engaged.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```
4. The Dashboard will show: **🚨 THREAT ISOLATED — VPC NACL LOCKED DOWN**

---

### Step 5 — Reset for Another Demo Run
```powershell
python aws_infrastructure\reset_nacl.py
```
This removes the NACL rule and resets the dashboard counter to 0 so you can re-trigger the circuit breaker.

---

### Step 6 — Shutdown *(to avoid unnecessary AWS costs)*
```powershell
python aws_infrastructure\cleanup.py
```
This **stops** (does not terminate) the EC2 instance and purges the SQS queue.
Stopped instances are not billed for compute — only for the storage volume.

---

### Watching the EC2 Sniffer Live
If EC2 deployed successfully, you can watch the sniffer in real time:
```powershell
# Connect to EC2
ssh -i aws_infrastructure\aegis_edge_key.pem ec2-user@<SENSOR_IP>

# Attach to the running sniffer session
tmux attach -t aegis
```
You will see a live feed of packets being intercepted and sent to SQS:
```
[+] SQS Ingest: 1.2.3.4 -> 10.0.1.19 | 1234 bytes
[+] SQS Ingest: 5.6.7.8 -> 10.0.1.19 | 987 bytes
```

---

## 🧠 AI Model Details

| Parameter | Value |
|-----------|-------|
| Algorithm | Isolation Forest (`sklearn.ensemble.IsolationForest`) |
| Contamination | `0.01` (expects 1% anomalies in training data) |
| Feature Vector | `[packet_count, total_bytes, packet_rate, byte_rate, entropy]` |
| Window Size | 10 seconds (sliding) |
| Calibration Period | 20 seconds on startup |
| Soft Threshold | `> 1.5×` calibrated baseline average |
| Hard Override | `> 10×` baseline (bypasses model — defends against data poisoning) |

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
fastapi      — REST API framework for the AI Core
uvicorn      — ASGI server for FastAPI
boto3        — AWS SDK (EC2, SQS, NACL management)
scapy        — Raw packet capture on the EC2 Linux sensor
scikit-learn — IsolationForest anomaly detection model
pandas       — Feature extraction and windowed traffic analysis
numpy        — Mathematical operations for entropy calculation
requests     — HTTP communication between dashboard and AI Core
```

Install all at once:
```bash
pip install -r requirements.txt
```
