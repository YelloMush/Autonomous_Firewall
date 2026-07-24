import time
import json
import boto3
import platform
import traceback
import os
from scapy.all import sniff, IP, TCP, UDP

class CloudSensorNode:
    def __init__(self, sqs_url):
        self.os_type = platform.system()
        print(f"[*] Edge Sensor initialized on {self.os_type}")
        self.sqs = boto3.client('sqs', region_name='ap-south-1')
        self.sqs_url = sqs_url

    def parse_packet(self, packet):
        if IP in packet:
            packet_data = {
                "timestamp": time.time(),
                "src_ip": packet[IP].src,
                "dst_ip": packet[IP].dst,
                "length": len(packet),
                "protocol": "OTHER",
                "src_port": 0,
                "dst_port": 0,
                "tcp_flags": "NONE"
            }

            if TCP in packet:
                packet_data["protocol"] = "TCP"
                packet_data["src_port"] = packet[TCP].sport
                packet_data["dst_port"] = packet[TCP].dport
                packet_data["tcp_flags"] = str(packet[TCP].flags)
            elif UDP in packet:
                packet_data["protocol"] = "UDP"
                packet_data["src_port"] = packet[UDP].sport
                packet_data["dst_port"] = packet[UDP].dport

            # Push to Amazon SQS M/M/c Buffer
            try:
                self.sqs.send_message(
                    QueueUrl=self.sqs_url,
                    MessageBody=json.dumps(packet_data)
                )
                print(f"[+] SQS Ingest: {packet_data['src_ip']} -> {packet_data['dst_ip']} | {packet_data['length']} bytes")
            except Exception as e:
                pass # Fail silently on the edge to maintain throughput under attack

if __name__ == "__main__":
    sqs_url = ""
    config_path = os.path.join(os.path.dirname(__file__), "..", "aws_infrastructure", "aegis_config.txt")
    try:
        with open(config_path, "r") as f:
            for line in f:
                if line.startswith("SQS_QUEUE_URL="):
                    sqs_url = line.strip().split("=")[1]
    except Exception as e:
        print(f"[-] Config read error: {e}")

    if not sqs_url:
        sqs_url = "https://sqs.ap-south-1.amazonaws.com/619459868389/Aegis-Ingestion-Queue" # Fallback from memory

    node = CloudSensorNode(sqs_url)
    print(f"[*] Starting Cloud Sensor. Routing traffic to SQS...")
    
    try:
        sniff(prn=node.parse_packet, store=False)
    except KeyboardInterrupt:
        print("\n[*] Sniffing stopped.")
    except Exception as e:
        traceback.print_exc()
