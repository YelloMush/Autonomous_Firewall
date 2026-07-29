from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sqlite3
import time
import asyncio
import traceback
import json
import boto3
import os
from analytics_engine import AnalyticsEngine

app = FastAPI(title="Aegis AI Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast(self, message: dict):
        for connection in self.active_connections.copy():
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# ─────────────────────────────────────────────
# AI Engine  (10-second sliding window)
# ─────────────────────────────────────────────
ai_engine = AnalyticsEngine(window_size=10, slide_step=1)

# ─────────────────────────────────────────────
# AWS Configuration
# ─────────────────────────────────────────────
REGION = 'ap-south-1'

# Lazy clients — created on first use so env-var credentials are always picked up
_sqs_client = None
_ec2_client = None

def get_sqs():
    global _sqs_client
    if _sqs_client is None:
        _sqs_client = boto3.client('sqs', region_name=REGION)
    return _sqs_client

def get_ec2():
    global _ec2_client
    if _ec2_client is None:
        _ec2_client = boto3.client('ec2', region_name=REGION)
    return _ec2_client

def get_config():
    config = {}
    config_path = os.path.join(os.path.dirname(__file__), "..", "aws_infrastructure", "aegis_config.txt")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    config[k] = v
    return config

CONFIG      = get_config()
SQS_QUEUE_URL = CONFIG.get("SQS_QUEUE_URL", "https://sqs.ap-south-1.amazonaws.com/619459868389/Aegis-Ingestion-Queue")
NACL_ID       = CONFIG.get("NACL_ID", "")

# ─────────────────────────────────────────────
# Async write queue – single writer, no locks
# ─────────────────────────────────────────────
_db_write_queue: asyncio.Queue = None   # initialised in startup

DB_PATH = os.path.join(os.path.dirname(__file__), "firewall_logs.db")

def _init_db():
    """Create tables and enable WAL mode (called once at startup)."""
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute('''CREATE TABLE IF NOT EXISTS traffic_logs (
                        id        INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp REAL,
                        src_ip    TEXT,
                        dst_ip    TEXT,
                        protocol  TEXT,
                        size      INTEGER
                    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS blocked_ips (
                        ip        TEXT PRIMARY KEY,
                        timestamp REAL,
                        reason    TEXT
                    )''')
    conn.commit()
    conn.close()

def _get_read_conn():
    """Read-only connection for GET endpoints and the live monitor."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True,
                           timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

async def _db_writer_loop():
    """
    Single coroutine that owns the write connection.
    All inserts are serialised through _db_write_queue so SQLite never sees
    concurrent writers and the 'database is locked' error is impossible.
    """
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    try:
        while True:
            item = await _db_write_queue.get()
            if item is None:
                break
            sql, params = item
            try:
                conn.execute(sql, params)
                conn.commit()
            except Exception as e:
                print(f"[-] DB write error: {e}")
            _db_write_queue.task_done()
    finally:
        conn.close()

def _queue_write(sql: str, params: tuple):
    """Fire-and-forget: push a write onto the async queue."""
    _db_write_queue.put_nowait((sql, params))

# ─────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────
@app.on_event("startup")
async def setup_system():
    global _db_write_queue
    print("[*] Starting Distributed AI Firewall Core...")
    print("[*] Initialising SQLite database (WAL mode)...")
    _init_db()
    _db_write_queue = asyncio.Queue()

    # Launch all background tasks
    asyncio.create_task(_db_writer_loop())
    asyncio.create_task(sqs_ingestion_loop())
    asyncio.create_task(anomaly_detection_loop())
    print("[+] System Boot Sequence Complete. AI Core is polling SQS.")

# ─────────────────────────────────────────────
# SQS ingestion loop
# ─────────────────────────────────────────────
async def sqs_ingestion_loop():
    if not SQS_QUEUE_URL:
        return
    print(f"[*] Starting SQS Ingestion Loop on {SQS_QUEUE_URL}")
    loop = asyncio.get_event_loop()
    try:
        sqs = get_sqs()
    except Exception as e:
        print(f"[-] SQS client error: {e}")
        return

    while True:
        try:
            response = await loop.run_in_executor(None, lambda: sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=10,
                WaitTimeSeconds=5
            ))
            messages = response.get('Messages', [])
            if not messages:
                await asyncio.sleep(0.1)
                continue

            for msg in messages:
                body = json.loads(msg['Body'])
                body["timestamp"] = time.time()   # fix clock drift
                _queue_write(
                    "INSERT INTO traffic_logs (timestamp, src_ip, dst_ip, protocol, size) VALUES (?,?,?,?,?)",
                    (body.get("timestamp"), body.get("src_ip"), body.get("dst_ip"),
                     body.get("protocol"), body.get("length"))
                )
                ai_engine.add_packet(body)

            # Batch-delete from SQS
            entries = [{'Id': msg['MessageId'], 'ReceiptHandle': msg['ReceiptHandle']} for msg in messages]
            await loop.run_in_executor(None,
                lambda: sqs.delete_message_batch(QueueUrl=SQS_QUEUE_URL, Entries=entries))

        except Exception as e:
            print(f"[-] SQS Polling Error: {e}")
            await asyncio.sleep(2)

# ─────────────────────────────────────────────
# Cloud Circuit Breaker
# ─────────────────────────────────────────────
def trigger_cloud_circuit_breaker(current_time):
    banner = "!" * 55
    print(f"\n{banner}")
    print("🚨  INITIATING CLOUD CIRCUIT BREAKER  🚨")
    print(f"{banner}")

    if not NACL_ID:
        print("[-] NACL_ID missing from config — skipping AWS call (demo mode).")
    else:
        try:
            ec2 = get_ec2()
            for egress in (False, True):
                ec2.create_network_acl_entry(
                    NetworkAclId=NACL_ID, RuleNumber=99,
                    Protocol='-1', RuleAction='deny',
                    Egress=egress, CidrBlock='0.0.0.0/0'
                )
            print("[+] SUCCESS: VPC NACL Lockdown Engaged. Malicious traffic isolated.")
        except Exception as e:
            if 'RuleAlreadyExists' in str(e):
                print("[*] NACL Rule 99 already exists — system already isolated.")
            else:
                print(f"[-] NACL Injection Failed: {e}")

    print(f"{banner}\n")

    _queue_write(
        "INSERT OR IGNORE INTO blocked_ips (ip, timestamp, reason) VALUES (?,?,?)",
        ("VOLUMETRIC_ANOMALY", current_time,
         "Isolation Forest triggered: Cloud Circuit Breaker Engaged")
    )

# ─────────────────────────────────────────────
# Anomaly Detection Loop  (the AI brain)
# ─────────────────────────────────────────────
async def anomaly_detection_loop():
    print("\n" + "=" * 45)
    print("PHASE 1: AI CALIBRATION IN PROGRESS")
    print("Waiting for baseline data from SQS...")
    print("=" * 45 + "\n")

    baseline_data = []
    calibration_time = 20

    for i in range(calibration_time):
        await asyncio.sleep(ai_engine.slide_step)
        features = ai_engine.extract_features(time.time())
        if features and features["packet_count"] > 0:
            baseline_data.append(features)
            print(f"[*] Calibrating… {len(baseline_data)}/{calibration_time} points captured.")
            
        # Broadcast calibration progress to Web UI
        await manager.broadcast({
            "type": "metrics",
            "time": time.time(),
            "packet_count": features["packet_count"] if features else 0,
            "total_bytes": features["total_bytes"] if features else 0,
            "entropy": features["entropy"] if features else 0.0,
            "threshold": 0,
            "circuit_breaker_active": False
        })
        if i % 2 == 0:
            await manager.broadcast({"type": "alert", "message": f"Calibrating AI Model... {i+1}/{calibration_time}s"})

    # ── Synthetic baseline ──────────────────────────────────────────────────
    # We need DIVERSE synthetic points so IsolationForest can learn what
    # "normal" looks like and actually flag a spike as -1 (anomaly).
    # Using identical rows causes IsolationForest to output 1 for everything.
    SYNTH_NORMAL_COUNT = max(0, 12 - len(baseline_data))
    if SYNTH_NORMAL_COUNT > 0:
        print(f"\n[*] Injecting {SYNTH_NORMAL_COUNT} diverse synthetic baseline points…")
        import random
        for _ in range(SYNTH_NORMAL_COUNT):
            baseline_data.append({
                "packet_count": random.randint(3, 8),
                "total_bytes":  random.randint(500, 2000),
                "packet_rate":  round(random.uniform(1.5, 4.0), 2),
                "byte_rate":    round(random.uniform(200, 1000), 2),
                "entropy":      round(random.uniform(0.3, 1.2), 2),
            })

    ai_engine.train_baseline(baseline_data)

    # The real baseline average is the NETWORK average (not the synthetics)
    net_points = [d for d in baseline_data if d["packet_count"] <= 10]
    baseline_avg = (sum(d["packet_count"] for d in net_points) / len(net_points)) if net_points else 5

    threshold = baseline_avg * 1.5
    print("\n" + "=" * 45)
    print("PHASE 2: CALIBRATION COMPLETE. AI IS NOW ARMED.")
    print(f"[*] Anomaly threshold: > {threshold:.1f} packets / {ai_engine.window_size}s window")
    print("=" * 45 + "\n")

    # ── Live detection ──────────────────────────────────────────────────────
    circuit_breaker_active = False
    HARD_MULTIPLIER = 10   # If spike is 10x baseline, always flag — no model needed

    while True:
        await asyncio.sleep(ai_engine.slide_step)
        current_time = time.time()
        features = ai_engine.extract_features(current_time)

        if not features:
            features = {
                "packet_count": 0,
                "total_bytes": 0,
                "entropy": 0.0
            }

        pkt = features["packet_count"]

        # Broadcast live telemetry to web dashboard
        await manager.broadcast({
            "type": "metrics",
            "time": current_time,
            "packet_count": pkt,
            "total_bytes": features["total_bytes"],
            "entropy": features["entropy"],
            "threshold": threshold,
            "circuit_breaker_active": circuit_breaker_active
        })

        # Only log when something notable happens (reduces terminal noise)
        if pkt > threshold:
            if circuit_breaker_active:
                await asyncio.sleep(10)
                circuit_breaker_active = False
                continue

            print(f"\n[AI] 🛑 SPIKE DETECTED ({pkt} pkts > threshold {threshold:.1f})")
            print(f"[AI] Bytes: {features['total_bytes']} | Entropy: {features['entropy']:.2f}")

            # Hard override: if spike is astronomically above baseline, bypass the model.
            # This handles the case where SQS backlog poisoned the calibration phase.
            if pkt > threshold * HARD_MULTIPLIER:
                print(f"[AI] ⚡ HARD OVERRIDE: Spike is {pkt/max(threshold,1):.0f}× baseline — "
                      f"forcing anomaly without model inference.")
                prediction = -1
            else:
                try:
                    prediction = ai_engine.check_anomaly(features)
                    print(f"[AI] Isolation Forest prediction: {prediction}  "
                          f"(−1 = anomaly, +1 = normal)")
                except Exception as e:
                    print(f"[-] AI inference error: {e}")
                    prediction = -1

            if prediction == -1:
                print(f"\n[{time.strftime('%H:%M:%S')}] 🛑 AI DETECTED ANOMALOUS VOLUMETRIC SPIKE.")
                print(f"      Metrics: {pkt} packets | {features['total_bytes']} bytes")
                circuit_breaker_active = True
                await manager.broadcast({"type": "alert", "message": "VPC NACL Lockdown Engaged!"})
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, trigger_cloud_circuit_breaker, current_time)
                await asyncio.sleep(10)
            else:
                print(f"[AI] Model: traffic flagged as NORMAL — continuing surveillance.")
        else:
            # Quiet heartbeat — only print every 5 seconds to keep terminal clean
            if int(current_time) % 5 == 0:
                print(f"[AI] ✅ Normal → {pkt} pkts | {features['total_bytes']} bytes")

# ─────────────────────────────────────────────
# REST & WebSocket Endpoints
# ─────────────────────────────────────────────
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/system_status")
def get_system_status():
    try:
        conn = _get_read_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM traffic_logs")
        total_packets = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM blocked_ips")
        total_blocked = cursor.fetchone()[0]
        conn.close()
    except Exception:
        total_packets, total_blocked = 0, 0
    return {
        "packets_analyzed": total_packets,
        "active_blocks":    total_blocked,
        "system_health":    "Online"
    }

@app.post("/ingest")
async def local_ingest(packet: dict):
    """
    Presentation fallback: dashboard fires packets directly here,
    bypassing SQS entirely so the demo works regardless of AWS networking.
    """
    packet["timestamp"] = time.time()
    _queue_write(
        "INSERT INTO traffic_logs (timestamp, src_ip, dst_ip, protocol, size) VALUES (?,?,?,?,?)",
        (packet.get("timestamp"), packet.get("src_ip", "1.1.1.1"),
         packet.get("dst_ip", "10.0.1.19"), packet.get("protocol", "UDP"),
         packet.get("length", 1000))
    )
    ai_engine.add_packet(packet)
    return {"status": "ingested"}

# Serve the Web UI (must be at the bottom so API routes match first)
DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "..", "web_dashboard")
app.mount("/", StaticFiles(directory=DASHBOARD_DIR, html=True), name="static")

# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    try:
        print("[*] Starting Distributed AI Firewall Core...")
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
    except Exception:
        traceback.print_exc()
    finally:
        input("Press ENTER to exit…")