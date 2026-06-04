import os
import time
import platform
import subprocess
import traceback
from scapy.all import sniff, IP, TCP, UDP

class NetworkNode:
    def __init__(self):
        self.os_type = platform.system()
        print(f"System detected: {self.os_type}")

    def block_ip(self, target_ip):
        """Blocks an IP dynamically based on the Operating System."""
        print(f"ATTEMPTING TO BLOCK MALICIOUS IP: {target_ip}")
        
        try:
            if self.os_type == "Windows":
                # Windows Defender Firewall command
                cmd = f'netsh advfirewall firewall add rule name="Block_{target_ip}" dir=in action=block remoteip={target_ip}'
                subprocess.run(cmd, shell=True, check=True, stdout=subprocess.DEVNULL)
                print(f"SUCCESS: {target_ip} blocked via Windows Firewall.")
                
            elif self.os_type == "Linux":
                # Linux IPTables command
                cmd = ["sudo", "iptables", "-A", "INPUT", "-s", target_ip, "-j", "DROP"]
                subprocess.run(cmd, check=True)
                print(f"SUCCESS: {target_ip} blocked via IPTables.")
                
        except subprocess.CalledProcessError as e:
            print(f"ERROR: Failed to block IP. Did you run as Administrator/Root? Details: {e}")

    def parse_packet(self, packet):
        """Extracts required ML features from the raw packet."""
        if IP in packet:
            # Core Network Layer Features
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

            # Transport Layer Features
            if TCP in packet:
                packet_data["protocol"] = "TCP"
                packet_data["src_port"] = packet[TCP].sport
                packet_data["dst_port"] = packet[TCP].dport
                packet_data["tcp_flags"] = str(packet[TCP].flags)
                
            elif UDP in packet:
                packet_data["protocol"] = "UDP"
                packet_data["src_port"] = packet[UDP].sport
                packet_data["dst_port"] = packet[UDP].dport

            # Print to console (Later, this will be sent to Member 2's Sliding Window)
            print(packet_data)

            # SIMULATION: If we see traffic from a specific test IP, trigger the block
            # Change this IP to your phone's IP address to test the blocking feature
            test_attacker_ip = "192.168.1.99" 
            if packet_data["src_ip"] == test_attacker_ip:
                self.block_ip(test_attacker_ip)

if __name__ == "__main__":
    node = NetworkNode()
    print("Starting production sniffer... Press Ctrl+C to stop.")
    
    try:
        # store equals False prevents RAM overflow during high traffic
        sniff(prn=node.parse_packet, store=False)
    except Exception as e:
        print("CRITICAL FAILURE:")
        traceback.print_exc()
    finally:
        input("Press ENTER to exit...")