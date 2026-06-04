from fastapi import FastAPI, Request
import uvicorn
import sqlite3
import time

app = FastAPI(title="Firewall API")

def get_database_connection():
    connection = sqlite3.connect("firewall_logs.db")
    connection.row_factory = sqlite3.Row
    return connection

@app.on_event("startup")
def setup_database():
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
    print("Database ready.")

@app.post("/ingest_packet")
async def ingest_packet(request: Request):
    """Receives parsed packet dictionaries from Member 1 and saves them."""
    data = await request.json()
    connection = get_database_connection()
    
    connection.execute(
        "INSERT INTO traffic_logs (timestamp, src_ip, dst_ip, protocol, size) VALUES (?, ?, ?, ?, ?)",
        (data.get("timestamp"), data.get("src_ip"), data.get("dst_ip"), data.get("protocol"), data.get("length"))
    )
    
    connection.commit()
    connection.close()
    return {"status": "packet_saved"}

@app.get("/system_status")
def get_system_status():
    """Returns database statistics for the frontend dashboard."""
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
    import traceback
    try:
        print("Starting API Server on port 8000...")
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
    except Exception as e:
        print("CRITICAL FAILURE:")
        traceback.print_exc()
    finally:
        input("Press ENTER to exit...")