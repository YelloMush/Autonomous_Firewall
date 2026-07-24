import boto3

REGION = 'ap-south-1'

def cleanup():
    ec2 = boto3.client('ec2', region_name=REGION)
    sqs = boto3.client('sqs', region_name=REGION)
    
    print("=" * 50)
    print("  Project Aegis — AWS Cleanup")
    print("=" * 50)

    # ── Stop EC2 instance ──────────────────────────────
    print("\n[*] Looking for running EC2 instances...")
    try:
        resp = ec2.describe_instances(Filters=[
            {'Name': 'key-name',            'Values': ['aegis_edge_key']},
            {'Name': 'instance-state-name', 'Values': ['running', 'pending']},
        ])
        instances = [
            i['InstanceId']
            for r in resp['Reservations']
            for i in r['Instances']
        ]
        if instances:
            ec2.stop_instances(InstanceIds=instances)
            print(f"[+] Stopped instances: {instances}")
            print("    (Stopped = paused, NOT deleted. Your data is preserved.)")
        else:
            print("[*] No running instances found.")
    except Exception as e:
        print(f"[-] EC2 error: {e}")

    # ── Purge SQS queue ────────────────────────────────
    print("\n[*] Purging SQS Ingestion Queue...")
    SQS_URL = "https://sqs.ap-south-1.amazonaws.com/619459868389/Aegis-Ingestion-Queue"
    try:
        sqs.purge_queue(QueueUrl=SQS_URL)
        print("[+] SQS Queue flushed — no stale packets will poison tomorrow's calibration.")
    except Exception as e:
        if "PurgeQueueInProgress" in str(e):
            print("[+] Queue already being purged.")
        else:
            print(f"[-] SQS error: {e}")

    print("\n" + "=" * 50)
    print("  All AWS resources safely paused.")
    print("  Good night! 🌙")
    print("=" * 50)

if __name__ == "__main__":
    cleanup()
