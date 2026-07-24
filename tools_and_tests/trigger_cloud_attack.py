import boto3
import json
import time
import random
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

def launch_synthetic_sqs_attack():
    print("[*] Bypassing ISP network filters...")
    print("[*] Directly injecting Volumetric Attack telemetry into SQS Buffer...")
    
    config = get_config()
    sqs_url = config.get("SQS_QUEUE_URL", "https://sqs.ap-south-1.amazonaws.com/619459868389/Aegis-Ingestion-Queue")
    
    sqs = boto3.client('sqs', region_name='ap-south-1')
    
    # Generate 50 packets to instantly trigger the 1.5x baseline threshold (which is ~7.5)
    messages = []
    for i in range(50):
        packet = {
            "timestamp": time.time(),
            "src_ip": f"192.168.1.{random.randint(10,250)}",
            "dst_ip": "10.0.1.19",
            "length": random.randint(1000, 1500),
            "protocol": "UDP",
            "src_port": random.randint(10000, 60000),
            "dst_port": 80,
            "tcp_flags": "NONE"
        }
        
        messages.append({
            'Id': str(i),
            'MessageBody': json.dumps(packet)
        })
        
        # SQS send_message_batch allows 10 messages at a time
        if len(messages) == 10:
            try:
                sqs.send_message_batch(QueueUrl=sqs_url, Entries=messages)
                print(f"[+] Injected 10 malicious UDP packets into SQS...")
            except Exception as e:
                print(f"[-] Injection failed: {e}")
            messages = []
            
    print("[+] Synthetic botnet payload successfully delivered to Cloud Queue!")
    print("[*] Watch your api_server terminal now!")

if __name__ == "__main__":
    launch_synthetic_sqs_attack()
