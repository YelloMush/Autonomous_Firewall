from fastapi import FastAPI, Request
import uvicorn
import sqlite3
import time
import asyncio
import traceback
from core_backend.analytics_engine import AnalyticsEngine

app = FastAPI(title="Firewall API")

# Initialize the AI Engine with a 2 second window
ai_engine = AnalyticsEngine(window_size=2, slide_step=1)

def get_database_connection():
    connection = sqlite3.connect("firewall_logs.db")
    connection.row_factory = sqlite3.Row
    return connection

@app.on_event("startup")
async def setup_system():
    print("Initializing SQLite Database...")
    connection = get_database_connection()
    cursor = connection.cursor()
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS traffic_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        timestamp REAL, 
                        src_ip TEXT, 
                        dst_ip TEXT, 
                        protocol TEXT, 
                        size INTEGER
                    )''')
                    
    cursor.execute('''CREATE TABLE IF NOT EXISTS blocked_ips (
                        ip TEXT PRIMARY KEY, 
                        timestamp REAL, 
                        reason TEXT
                    )''')
                    
    connection.commit()
    connection.close()
    
    # Start the monitoring and calibration loop
    asyncio.create_task(anomaly_detection_loop())
    print("Database ready. Starting Boot Sequence...")

@app.post("/ingest_packet")
async def ingest_packet(request: Request):
    data = await request.json()
    
    # Send packet to database
    connection = get_database_connection()
    connection.execute(
        "INSERT INTO traffic_logs (timestamp, src_ip, dst_ip, protocol, size) VALUES (?, ?, ?, ?, ?)",
        (data.get("timestamp"), data.get("src_ip"), data.get("dst_ip"), data.get("protocol"), data.get("length"))
    )
    connection.commit()
    connection.close()
    
    # Send packet to AI sliding window buffer
    ai_engine.add_packet(data)
    
    return {"status": "packet_saved"}

async def anomaly_detection_loop():
    """Handles both the initial calibration phase and the continuous detection loop."""
    print("\n" + "="*40)
    print("PHASE 1: AI CALIBRATION IN PROGRESS")
    print("Ensure the sniffer is running. Please browse the web normally.")
    print("Gathering baseline data for 20 seconds...")
    print("="*40 + "\n")
    
    baseline_data = []
    calibration_time = 20  # Seconds to observe normal traffic
    
    for i in range(calibration_time):
        await asyncio.sleep(ai_engine.slide_step)
        current_time = time.time()
        features = ai_engine.extract_features(current_time)
        
        if features:
            baseline_data.append(features)
            print(f"Calibrating... {len(baseline_data)}/{calibration_time} data points captured.")
            
    if len(baseline_data) > 5:
        ai_engine.train_baseline(baseline_data)
        print("\n" + "="*40)
        print("PHASE 2: CALIBRATION COMPLETE. AI IS NOW ARMED.")
        print("="*40 + "\n")
    else:
        print("\n[ERROR] Not enough traffic captured during calibration. Is the sniffer running? Please restart the server.")
        return

    # Phase 2: Live Threat Detection
    while True:
        await asyncio.sleep(ai_engine.slide_step)
        current_time = time.time()
        features = ai_engine.extract_features(current_time)
        
        # We only check for anomalies if there is a noticeable spike in traffic
        if features and features["packet_count"] > (sum(d["packet_count"] for d in baseline_data) / len(baseline_data)) * 1.5:
            prediction = ai_engine.check_anomaly(features)
            
            if prediction == -1:
                print(f"[{time.strftime('%H:%M:%S')}] 🛑 WARNING: AI DETECTED ANOMALOUS TRAFFIC SPIKE.")
                print(f"      Metrics: {features['packet_count']} packets, {features['total_bytes']} bytes")
                
                connection = get_database_connection()
                connection.execute(
                    "INSERT OR IGNORE INTO blocked_ips (ip, timestamp, reason) VALUES (?, ?, ?)",
                    ("VOLUMETRIC_ANOMALY", current_time, "Isolation Forest triggered")
                )
                connection.commit()
                connection.close()

@app.get("/system_status")
def get_system_status():
    connection = get_database_connection()
    cursor = connection.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM traffic_logs")
    total_packets = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM blocked_ips")
    total_blocked = cursor.fetchone()[0]
    
    connection.close()
    
    return {
        "packets_analyzed": total_packets,
        "active_blocks": total_blocked,
        "system_health": "Online"
    }

if __name__ == "__main__":
    try:
        print("Starting AI Firewall Core...")
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
    except Exception as e:
        print("CRITICAL FAILURE:")
        traceback.print_exc()
    finally:
        input("Press ENTER to exit...")