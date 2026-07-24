import sqlite3
import time
import os

DB_NAME = os.path.join(os.path.dirname(__file__), "..", "core_backend", "firewall_logs.db")

RESET  = "\033[0m"
RED    = "\033[91m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
GREEN  = "\033[92m"
BOLD   = "\033[1m"

def get_conn():
    """Open a read-only WAL-compatible connection."""
    return sqlite3.connect(f"file:{os.path.abspath(DB_NAME)}?mode=ro",
                           uri=True, timeout=10, check_same_thread=False)

def live_monitor():
    print("=" * 60)
    print(f"{BOLD}🛡️  AEGIS LIVE DATABASE MONITOR{RESET}")
    print("=" * 60)

    if not os.path.exists(DB_NAME):
        print(f"[!] Waiting for AI Core to create the database…")
        while not os.path.exists(DB_NAME):
            time.sleep(1)

    try:
        conn = get_conn()
        cursor = conn.cursor()

        # Wait for tables to exist
        tables = []
        while not tables:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [t[0] for t in cursor.fetchall() if t[0] != "sqlite_sequence"]
            if not tables:
                time.sleep(1)

        print(f"[*] Connected. Monitoring: {', '.join(tables)}\n")

        last_seen = {t: 0 for t in tables}

        while True:
            try:
                for table in tables:
                    cursor.execute(
                        f"SELECT * FROM {table} WHERE rowid > ? ORDER BY rowid ASC",
                        (last_seen[table],)
                    )
                    for row in cursor.fetchall():
                        if "block" in table.lower():
                            print(f"{RED}{BOLD}🚨 [THREAT ISOLATED]{RESET}  {table} → {row}")
                        else:
                            print(f"{CYAN}📥 [PACKET]{RESET}  {table} → {row}")
                        last_seen[table] = row[0]
            except sqlite3.OperationalError:
                pass  # DB briefly locked — just skip this cycle

            time.sleep(0.4)

    except KeyboardInterrupt:
        print("\n[*] Monitor terminated.")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    live_monitor()