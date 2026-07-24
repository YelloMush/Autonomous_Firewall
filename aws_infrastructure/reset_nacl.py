"""
reset_nacl.py — Remove the Aegis Circuit Breaker NACL rule
============================================================
Run this after each demo to clear the Priority-99 DENY ALL rule
so you can re-trigger the Circuit Breaker in the next demo run.
"""
import boto3
import os

REGION = 'ap-south-1'

def get_config():
    cfg = {}
    path = os.path.join(os.path.dirname(__file__), "aegis_config.txt")
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    cfg[k] = v
    return cfg

def reset_nacl():
    print("\n" + "="*50)
    print("  🔓  Aegis NACL Reset — Removing Circuit Breaker Rule")
    print("="*50)

    cfg     = get_config()
    nacl_id = cfg.get("NACL_ID", "")

    if not nacl_id:
        print("[-] NACL_ID not found in aegis_config.txt")
        return

    ec2 = boto3.client('ec2', region_name=REGION)
    removed = 0

    for egress in (False, True):
        direction = "EGRESS" if egress else "INGRESS"
        try:
            ec2.delete_network_acl_entry(
                NetworkAclId=nacl_id,
                RuleNumber=99,
                Egress=egress
            )
            print(f"[+] Removed Rule 99 ({direction}) from {nacl_id}")
            removed += 1
        except Exception as e:
            if "InvalidNetworkAclEntry.NotFound" in str(e):
                print(f"[*] Rule 99 ({direction}) not present — already clean.")
            else:
                print(f"[-] Error removing {direction} rule: {e}")

    # Also clear the blocked_ips table so the dashboard resets to 0
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), "..", "core_backend", "firewall_logs.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path, timeout=10)
            conn.execute("DELETE FROM blocked_ips")
            conn.commit()
            conn.close()
            print("[+] blocked_ips table cleared — dashboard counter reset to 0.")
    except Exception as e:
        print(f"[!] Could not clear DB: {e}")

    print()
    if removed > 0:
        print("✅  NACL reset complete! You can re-trigger the Circuit Breaker.")
    else:
        print("✅  Nothing to reset — system is already in clean state.")
    print("="*50 + "\n")

if __name__ == "__main__":
    reset_nacl()
