from fastapi import FastAPI, Request
import uvicorn
import sqlite3
import time
import asyncio
import traceback
from analytics_engine import AnalyticsEngine

app = FastAPI(title="Firewall API")

# Initialize the AI Engine with a 2 second window
ai_engine = AnalyticsEngine(window_size=2, slide_step=1)

def get_database_connection():
    connection = sqlite3.connect("firewall_logs.db")
    connection.row_factory = sqlite3.Row
    return connection

def train_dummy_baseline():
    print("Training AI on clean baseline traffic...")
    dummy_clean_data = [
        {"packet_count": 5, "total_bytes": 300, "packet_rate": 2.5, "byte_rate": 150.0, "entropy": 0.0},
        {"packet_count": 6, "total_bytes": 350, "packet_rate": 3.0, "byte_rate": 175.0, "entropy": 0.1},
        {"packet_count": 4, "total_bytes": 250, "packet_rate": 2.0, "byte_rate": 125.0, "entropy": 0.0}
    ]
    ai_engine.train_baseline(dummy_clean_data)

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
    
    # Train the AI and start the monitoring loop
    train_dummy_baseline()
    asyncio.create_task(anomaly_detection_loop())
    print("Database and AI Engine ready.")

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
    """Runs continuously in the background to check the sliding window."""
    while True:
        await asyncio.sleep(ai_engine.slide_step)
        
        current_time = time.time()
        features = ai_engine.extract_features(current_time)
        
        if features and features["packet_count"] > 10:
            # We only check for anomalies if there is enough traffic to analyze
            prediction = ai_engine.check_anomaly(features)
            
            if prediction == -1:
                print("WARNING: AI DETECTED ANOMALOUS TRAFFIC SPIKE.")
                print("Triggering defensive protocols...")
                # In a full deployment, this is where we log the most frequent IP to the block database
                # For now, we log the event
                connection = get_database_connection()
                connection.execute(
                    "INSERT OR IGNORE INTO blocked_ips (ip, timestamp, reason) VALUES (?, ?, ?)",
                    ("MULTIPLE_IPS_ANOMALY", current_time, "Isolation Forest triggered")
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