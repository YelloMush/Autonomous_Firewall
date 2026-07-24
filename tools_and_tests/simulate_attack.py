import threading
import time
import random
import tkinter as tk
from tkinter import font as tkfont
import requests

# ─────────────────────────────────────────────────────────────
# Attack injection — direct HTTP → /ingest, no ISP/SQS issues
# ─────────────────────────────────────────────────────────────
attack_running = False

def launch_attack():
    global attack_running
    if attack_running:
        return
    attack_running = True
    status_label.config(text="⚡  ATTACK IN PROGRESS…", fg=ORANGE)
    attack_btn.config(state="disabled", bg="#880000")

    def inject():
        global attack_running
        try:
            for i in range(60):
                packet = {
                    "timestamp": time.time(),
                    "src_ip":    f"{random.randint(1,254)}.{random.randint(0,254)}"
                                 f".{random.randint(0,254)}.{random.randint(1,254)}",
                    "dst_ip":    "10.0.1.19",
                    "length":    random.randint(1000, 1500),
                    "protocol":  "UDP",
                    "src_port":  random.randint(10000, 60000),
                    "dst_port":  80,
                    "tcp_flags": "NONE",
                }
                requests.post("http://127.0.0.1:8000/ingest", json=packet, timeout=2)
                time.sleep(0.05)
        except Exception as e:
            print(f"[-] Injection error: {e}")
        finally:
            attack_running = False
            root.after(0, lambda: attack_btn.config(state="normal", bg=RED))

    threading.Thread(target=inject, daemon=True).start()

# ─────────────────────────────────────────────────────────────
# Data polling
# ─────────────────────────────────────────────────────────────
prev_packets = 0

def fetch_data():
    global prev_packets
    try:
        res = requests.get("http://127.0.0.1:8000/system_status", timeout=1).json()
        pkts   = res.get("packets_analyzed", 0)
        blocks = res.get("active_blocks", 0)

        packets_var.set(f"{pkts:,}")
        blocks_var.set(str(blocks))

        delta = pkts - prev_packets
        prev_packets = pkts

        if blocks > 0:
            status_label.config(
                text="🚨  THREAT ISOLATED — VPC NACL LOCKED DOWN",
                fg=RED
            )
            blocks_label.config(fg=RED)
            canvas.itemconfig(threat_ring, outline=RED)
        elif delta > 20:
            status_label.config(text="⚡  HIGH TRAFFIC DETECTED", fg=ORANGE)
            canvas.itemconfig(threat_ring, outline=ORANGE)
        elif not attack_running:
            status_label.config(text="✅  All Systems Normal", fg=GREEN)
            blocks_label.config(fg=GREEN)
            canvas.itemconfig(threat_ring, outline=GREEN)

        # Pulse the ring when traffic is flowing
        if delta > 0:
            animate_ring(delta)

        # Connection OK
        conn_dot.config(bg=GREEN)

    except Exception:
        conn_dot.config(bg=RED)
        status_label.config(text="⚠️   Waiting for AI Core (api_server.py)…", fg=YELLOW)

    root.after(400, fetch_data)

def animate_ring(delta):
    """Briefly flash the radar ring proportional to traffic volume."""
    intensity = min(delta * 2, 80)
    colour = f"#{min(255, intensity*3):02x}{max(0, 180-intensity):02x}00"
    canvas.itemconfig(threat_ring, outline=colour, width=max(2, intensity // 15))
    root.after(300, lambda: canvas.itemconfig(threat_ring, outline=GREEN, width=2))

# ─────────────────────────────────────────────────────────────
# UI
# ─────────────────────────────────────────────────────────────
BG      = "#080c10"
PANEL   = "#0d1520"
GREEN   = "#00ff88"
RED     = "#ff3333"
ORANGE  = "#ff9900"
YELLOW  = "#ffdd00"
CYAN    = "#00ccff"
GREY    = "#334455"

root = tk.Tk()
root.title("Project Aegis — Autonomous AI Firewall")
root.geometry("680x560")
root.configure(bg=BG)
root.resizable(False, False)

mono    = tkfont.Font(family="Courier New", size=11)
mono_lg = tkfont.Font(family="Courier New", size=28, weight="bold")
mono_xl = tkfont.Font(family="Courier New", size=13, weight="bold")
mono_sm = tkfont.Font(family="Courier New", size=9)

# ── Top bar ──────────────────────────────────────────────────
topbar = tk.Frame(root, bg=PANEL, height=56)
topbar.pack(fill="x")

tk.Label(topbar, text="🛡️  PROJECT AEGIS", fg=GREEN, bg=PANEL,
         font=tkfont.Font(family="Courier New", size=16, weight="bold")).pack(side="left", padx=18, pady=12)

tk.Label(topbar, text="Autonomous AI-Driven Self-Healing Cloud Firewall",
         fg=GREY, bg=PANEL, font=mono_sm).pack(side="left", pady=12)

conn_frame = tk.Frame(topbar, bg=PANEL)
conn_frame.pack(side="right", padx=18, pady=16)
tk.Label(conn_frame, text="AI CORE", fg=GREY, bg=PANEL, font=mono_sm).pack(side="left")
conn_dot = tk.Label(conn_frame, text=" ●", fg=RED, bg=PANEL, font=mono_sm)
conn_dot.pack(side="left")

# ── Radar canvas ─────────────────────────────────────────────
canvas = tk.Canvas(root, width=200, height=200, bg=BG, highlightthickness=0)
canvas.place(x=30, y=70)

for r in [90, 65, 40, 18]:
    canvas.create_oval(100-r, 100-r, 100+r, 100+r, outline="#1a2a3a", width=1)
canvas.create_line(100, 10, 100, 190, fill="#1a2a3a")
canvas.create_line(10, 100, 190, 100, fill="#1a2a3a")
threat_ring = canvas.create_oval(10, 10, 190, 190, outline=GREEN, width=2)
canvas.create_oval(90, 90, 110, 110, fill=GREEN, outline="")

tk.Label(root, text="NETWORK RADAR", fg=GREY, bg=BG, font=mono_sm).place(x=68, y=275)

# ── Stats panel ───────────────────────────────────────────────
stats = tk.Frame(root, bg=PANEL, relief="flat")
stats.place(x=250, y=70, width=400, height=200)

tk.Label(stats, text="PACKETS ANALYZED", fg=GREY, bg=PANEL, font=mono_sm).pack(pady=(18, 0))
packets_var = tk.StringVar(value="0")
tk.Label(stats, textvariable=packets_var, fg=CYAN, bg=PANEL, font=mono_lg).pack()

tk.Frame(stats, bg=GREY, height=1).pack(fill="x", padx=20, pady=6)

tk.Label(stats, text="ACTIVE BLOCKS", fg=GREY, bg=PANEL, font=mono_sm).pack()
blocks_var = tk.StringVar(value="0")
blocks_label = tk.Label(stats, textvariable=blocks_var, fg=GREEN, bg=PANEL, font=mono_lg)
blocks_label.pack()

# ── Status bar ───────────────────────────────────────────────
status_frame = tk.Frame(root, bg=PANEL, height=36)
status_frame.place(x=0, y=295, width=680)
status_label = tk.Label(status_frame, text="✅  All Systems Normal",
                         fg=GREEN, bg=PANEL, font=mono_xl)
status_label.pack(pady=6)

# ── Attack button ────────────────────────────────────────────
attack_btn = tk.Button(
    root,
    text="⚡  LAUNCH VOLUMETRIC ATTACK",
    bg=RED, fg="white",
    activebackground="#cc0000", activeforeground="white",
    font=tkfont.Font(family="Courier New", size=14, weight="bold"),
    relief="flat", bd=0, padx=20, pady=14,
    cursor="hand2",
    command=lambda: threading.Thread(target=launch_attack, daemon=True).start()
)
attack_btn.place(x=140, y=355, width=400)

# ── Info bar ─────────────────────────────────────────────────
info = tk.Frame(root, bg=BG)
info.place(x=0, y=450, width=680)

for label, val in [
    ("REGION", "ap-south-1"),
    ("QUEUE",  "Aegis-Ingestion-Queue"),
    ("MODEL",  "IsolationForest"),
    ("ACTION", "VPC NACL Deny"),
]:
    col = tk.Frame(info, bg=BG)
    col.pack(side="left", expand=True)
    tk.Label(col, text=label, fg=GREY,  bg=BG, font=mono_sm).pack()
    tk.Label(col, text=val,   fg=CYAN,  bg=BG, font=mono_sm).pack()

tk.Label(root, text="v2.0 Cloud Microservice Edition",
         fg="#223344", bg=BG, font=mono_sm).place(x=240, y=530)

fetch_data()
root.mainloop()