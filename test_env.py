import sys
import traceback

print(f"Using Python from: {sys.executable}")
print("-" * 40)

try:
    print("1. Testing Data Science libraries...")
    import pandas as pd
    import sklearn
    print("[SUCCESS] Pandas and Scikit-Learn are installed.")
except ImportError as e:
    print(f"[FAILED] Missing library: {e}")

try:
    print("2. Testing Scapy installation...")
    from scapy.all import sniff, conf
    print("[SUCCESS] Scapy is installed.")
except ImportError as e:
    print(f"[FAILED] Scapy is missing: {e}")

try:
    print("3. Testing Windows Npcap Driver and Network Interfaces...")
    from scapy.arch.windows import get_windows_if_list
    interfaces = get_windows_if_list()
    if len(interfaces) > 0:
        print(f"[SUCCESS] Npcap is working. Found {len(interfaces)} network interfaces.")
    else:
        print("[FAILED] Npcap is running, but no network interfaces were found.")
except Exception as e:
    print(f"[FAILED] Npcap Driver Error: {e}")
    traceback.print_exc()

print("-" * 40)
input("Press ENTER to close the diagnostic tool...")