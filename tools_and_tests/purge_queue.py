import boto3
import os

def get_config():
    config = {}
    config_path = os.path.join(os.path.dirname(__file__), "..", "aws_infrastructure", "aegis_config.txt")
    try:
        with open(config_path, "r") as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    config[k] = v
    except:
        pass
    return config

def purge():
    print("[*] Contacting AWS SQS to purge the backed-up queue...")
    config = get_config()
    sqs_url = config.get("SQS_QUEUE_URL", "https://sqs.ap-south-1.amazonaws.com/619459868389/Aegis-Ingestion-Queue")
    
    sqs = boto3.client('sqs', region_name='ap-south-1')
    try:
        sqs.purge_queue(QueueUrl=sqs_url)
        print("[+] SUCCESS: The AWS SQS Queue has been completely flushed!")
    except Exception as e:
        if "PurgeQueueInProgress" in str(e):
            print("[+] Queue is already being purged.")
        else:
            print(f"[-] Error: {e}")

if __name__ == "__main__":
    purge()
