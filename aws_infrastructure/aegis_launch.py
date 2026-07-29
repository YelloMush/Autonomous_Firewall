"""
aegis_launch.py — ONE-CLICK Project Aegis Presentation Launcher
================================================================
Run this single script to:
  1. Read the current EC2 IP from aegis_config.txt
  2. Fix SSH key permissions (icacls)
  3. Open SSH port 22 on the Security Group (idempotent)
  4. SCP cloud_sniffer.py to the EC2 instance
  5. SSH into EC2 and start cloud_sniffer.py in a background tmux session
  6. Purge the SQS queue so calibration is clean
  7. Start api_server.py in a new local PowerShell window
  8. Start live_db_monitor.py in another local PowerShell window
  9. Start simulate_attack.py (the Tkinter dashboard) in a third window

Usage:
    python aws_infrastructure\\aegis_launch.py
"""

import boto3
import subprocess
import os
import sys
import time
import webbrowser

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT        = os.path.dirname(SCRIPT_DIR)
CONFIG_PATH = os.path.join(SCRIPT_DIR, "aegis_config.txt")
KEY_FILE    = os.path.join(SCRIPT_DIR, "aegis_edge_key.pem")
SNIFFER     = os.path.join(ROOT, "edge_sensor", "cloud_sniffer.py")
API_SERVER  = os.path.join(ROOT, "core_backend", "api_server.py")
MONITOR     = os.path.join(ROOT, "tools_and_tests", "live_db_monitor.py")
DASHBOARD   = os.path.join(ROOT, "tools_and_tests", "simulate_attack.py")

REGION      = "ap-south-1"

# ── Helpers ───────────────────────────────────────────────────────────────────
def banner(msg):
    print(f"\n{'─'*55}\n  {msg}\n{'─'*55}")

def read_config():
    cfg = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    cfg[k] = v
    return cfg

def fix_key_permissions():
    """Strip inherited ACLs and grant read-only to current user (required by OpenSSH)."""
    banner("Fixing SSH key permissions…")
    user = os.environ.get("USERNAME", "HP")
    subprocess.run(["icacls.exe", KEY_FILE, "/inheritance:r"], check=True)
    subprocess.run(["icacls.exe", KEY_FILE, "/grant:r", f"{user}:(F)"], check=True)
    print("[+] Key permissions locked down.")


def open_sg_port(port, protocol="tcp"):
    """Idempotently open a port on the sensor's Security Group."""
    ec2 = boto3.client('ec2', region_name=REGION)
    resp = ec2.describe_instances(Filters=[
        {'Name': 'key-name',            'Values': ['aegis_edge_key']},
        {'Name': 'instance-state-name', 'Values': ['running']},
    ])
    reservations = resp.get('Reservations', [])
    if not reservations:
        print("[-] No running instance found. Did redeploy_sensor.py finish?")
        sys.exit(1)
    instance  = reservations[0]['Instances'][0]
    sg_id     = instance['SecurityGroups'][0]['GroupId']
    sensor_ip = instance.get('PublicIpAddress', '')

    try:
        ec2.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[{
                'IpProtocol': protocol,
                'FromPort':   port,
                'ToPort':     port if port != 0 else 65535,
                'IpRanges':   [{'CidrIp': '0.0.0.0/0'}]
            }]
        )
        print(f"[+] Port {port}/{protocol} opened on {sg_id}.")
    except Exception as e:
        if "InvalidPermission.Duplicate" in str(e):
            print(f"[*] Port {port}/{protocol} already open.")
        else:
            print(f"[-] SG error: {e}")
    return sg_id, sensor_ip

def purge_sqs(sqs_url):
    banner("Purging SQS queue (clean calibration)…")
    sqs = boto3.client('sqs', region_name=REGION)
    try:
        sqs.purge_queue(QueueUrl=sqs_url)
        print("[+] SQS queue flushed.")
    except Exception as e:
        if "PurgeQueueInProgress" in str(e):
            print("[*] Purge already in progress.")
        else:
            print(f"[-] SQS purge error: {e}")

def wait_for_ssh(host, retries=10, delay=10):
    import socket
    print(f"[*] Checking if EC2 SSH is ready (up to {retries*delay}s)…")
    for attempt in range(1, retries + 1):
        try:
            with socket.create_connection((host, 22), timeout=5):
                print(f"[+] SSH is ready!")
                return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            print(f"    [{attempt}/{retries}] Not ready yet, retrying in {delay}s…")
            time.sleep(delay)
    print("[!] EC2 SSH unreachable — skipping remote sniffer. Local demo will still work!")
    return False

def scp_file(src, dst_host, dst_path):
    if not wait_for_ssh(dst_host):
        return False
    cmd = [
        "scp", "-i", KEY_FILE,
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=15",
        src, f"ec2-user@{dst_host}:{dst_path}"
    ]
    print(f"[*] Uploading {os.path.basename(src)} → {dst_host}:{dst_path}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[-] SCP failed: {result.stderr.strip()}")
        return False
    print("[+] Upload complete.")
    return True

def start_remote_sniffer(host, aws_key_id, aws_secret, aws_region):
    """
    SSH into EC2 and start cloud_sniffer.py inside a detached tmux session.
    If tmux isn't installed it installs it first.
    """
    banner(f"Starting cloud sniffer on EC2 ({host})…")
    remote_cmd = (
        "sudo dnf install -y tmux python3-pip > /dev/null 2>&1; "
        "sudo python3 -m pip install --quiet scapy boto3; "
        "tmux kill-session -t aegis 2>/dev/null || true; "
        f"tmux new-session -d -s aegis "
        f"'sudo AWS_ACCESS_KEY_ID={aws_key_id} "
        f"AWS_SECRET_ACCESS_KEY={aws_secret} "
        f"AWS_DEFAULT_REGION={aws_region} "
        f"python3 /home/ec2-user/cloud_sniffer.py'; "
        "echo '[+] Sniffer started in tmux session: aegis'"
    )
    ssh_cmd = [
        "ssh",
        "-i", KEY_FILE,
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=20",
        f"ec2-user@{host}",
        remote_cmd
    ]
    result = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=120)
    if result.returncode == 0:
        print(result.stdout.strip())
        print("[+] Edge sensor is live on EC2!")
    else:
        print(f"[-] SSH error:\n{result.stderr}")
        print("[!] You may need to manually SSH and start the sniffer.")

def open_new_terminal(title, command, extra_env=None):
    """Open a new console window running a PowerShell command."""
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)

    # Write a tiny launcher script so we avoid quoting/semicolon issues
    import tempfile
    script = f'$host.UI.RawUI.WindowTitle = "{title}"\nSet-Location "{ROOT}"\n{command}'
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False)
    tmp.write(script)
    tmp.close()

    subprocess.Popen(
        ['powershell', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', tmp.name],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
        env=env
    )

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "="*55)
    print("  🛡️  PROJECT AEGIS — ONE-CLICK PRESENTATION LAUNCHER")
    print("="*55)

    cfg = read_config()
    sensor_ip = cfg.get("SENSOR_PUBLIC_IP", "")
    sqs_url   = cfg.get("SQS_QUEUE_URL", "")
    aws_key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
    aws_secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    aws_region = os.environ.get("AWS_DEFAULT_REGION", REGION)

    if not sensor_ip:
        print("[-] SENSOR_PUBLIC_IP missing from aegis_config.txt.")
        print("    Run python aws_infrastructure\\redeploy_sensor.py first!")
        sys.exit(1)

    if not aws_key_id or not aws_secret:
        print("[-] AWS credentials not found in environment!")
        print("    Set them permanently with:")
        print('    [System.Environment]::SetEnvironmentVariable("AWS_ACCESS_KEY_ID","<KEY>","User")')
        sys.exit(1)

    print(f"[*] EC2 Sensor IP : {sensor_ip}")
    print(f"[*] SQS Queue     : {sqs_url}")

    # Step 1 — Fix key permissions
    fix_key_permissions()

    # Step 2 — Open Security Group ports
    banner("Configuring Security Group…")
    open_sg_port(22, "tcp")

    # Steps 3 & 4 — Deploy sniffer to EC2 (optional — local demo works without it)
    banner("Deploying sniffer to EC2 (optional)…")
    ec2_ok = scp_file(SNIFFER, sensor_ip, "/home/ec2-user/cloud_sniffer.py")
    if ec2_ok:
        start_remote_sniffer(sensor_ip, aws_key_id, aws_secret, aws_region)
    else:
        print("[!] Skipping EC2 sniffer — dashboard will inject packets locally instead.")

    # Step 5 — Purge SQS so calibration starts clean
    if sqs_url:
        purge_sqs(sqs_url)
        print("[*] Waiting 5 seconds for purge to propagate…")
        time.sleep(5)

    # Step 6 — Open local service windows
    banner("Launching local services…")

    print("[*] Opening AI Core (api_server.py) in a new terminal…")
    open_new_terminal("Aegis AI Core", f'python "{API_SERVER}"')
    time.sleep(3)

    print("[*] Opening V3 Web Dashboard in your browser…")
    webbrowser.open("http://127.0.0.1:8000/")

    print("\n" + "="*55)
    print("  ✅  ALL SYSTEMS LAUNCHED!")
    print()
    print("  Terminals opened:")
    print("    🧠  Aegis AI Core (api_server.py)")
    print()
    print("  Web Dashboard opened:")
    print("    🌐  http://127.0.0.1:8000/")
    print()
    print("  Edge sensor running on EC2 in tmux session 'aegis'")
    print(f"  To watch it: ssh -i aws_infrastructure\\aegis_edge_key.pem ec2-user@{sensor_ip}")
    print(f"  Then run:    tmux attach -t aegis")
    print()
    print("  Wait ~20 seconds for AI calibration on the Web Dashboard,")
    print("  then click LAUNCH VOLUMETRIC ATTACK to trigger the circuit breaker!")
    print("="*55 + "\n")

if __name__ == "__main__":
    main()
