import sqlite3
import time
import os
import sys

# Change this if your database file has a different name
DB_NAME = "firewall_logs.db"

def get_tables(cursor):
    """Fetch all table names from the SQLite database."""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    return [t[0] for t in cursor.fetchall() if t[0] != "sqlite_sequence"]

def get_primary_key(cursor, table_name):
    """Dynamically find the primary key column of a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    for col in columns:
        if col[5] == 1: # Column index 5 indicates if it's a primary key (1=True)
            return col[1] # Column index 1 is the column name
    return columns[0][1] # Fallback to the first column if no PK is defined

def live_monitor():
    print("=" * 60)
    print(f"🛡️  AEGIS LIVE DATABASE MONITOR")
    print("=" * 60)
    
    if not os.path.exists(DB_NAME):
        print(f"[!] Database '{DB_NAME}' not found. Waiting for API Server to create it...")
        while not os.path.exists(DB_NAME):
            time.sleep(1)
            
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        tables = get_tables(cursor)
        if not tables:
            print("[!] No tables found in the database yet. Waiting...")
            while not tables:
                time.sleep(1)
                tables = get_tables(cursor)
                
        print(f"[*] Connected successfully. Monitoring tables: {', '.join(tables)}\n")
        
        # Keep track of the last seen ID for each table so we only print NEW rows
        last_seen_ids = {table: 0 for table in tables}
        pks = {table: get_primary_key(cursor, table) for table in tables}
        
        while True:
            for table in tables:
                pk = pks[table]
                last_id = last_seen_ids[table]
                
                # Fetch only rows that are newer than our last seen ID
                query = f"SELECT * FROM {table} WHERE {pk} > ? ORDER BY {pk} ASC"
                cursor.execute(query, (last_id,))
                new_rows = cursor.fetchall()
                
                for row in new_rows:
                    # Color code output: Red for blocks, Blue for standard metrics/packets
                    if "block" in table.lower():
                        print(f"🚨 [NEW THREAT ISOLATED] Table '{table}' -> {row}")
                    else:
                        print(f"📥 [PACKET INJECTED] Table '{table}' -> {row}")
                        
                    # Update the last seen ID
                    last_seen_ids[table] = row[0] 
                    
            time.sleep(0.5) # Poll twice a second for real-time feel
            
    except KeyboardInterrupt:
        print("\n[*] Live monitoring terminated by operator.")
    except Exception as e:
        print(f"\n[!] Error reading database: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    live_monitor()