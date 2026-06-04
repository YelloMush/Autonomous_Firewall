from scapy.all import sniff, IP, TCP, UDP
import time

def parse_packet(packet):
    # Ensure the packet has an IP layer (ignore ARP, STP, etc.)
    if IP in packet:
        packet_data = {
            "timestamp": time.time(),
            "source_ip": packet[IP].src,
            "dest_ip": packet[IP].dst,
            "size_bytes": len(packet),
            "protocol": "OTHER"
        }

        # Check Transport Layer
        if TCP in packet:
            packet_data["protocol"] = "TCP"
            packet_data["src_port"] = packet[TCP].sport
            packet_data["dst_port"] = packet[TCP].dport
        elif UDP in packet:
            packet_data["protocol"] = "UDP"
            packet_data["src_port"] = packet[UDP].sport
            packet_data["dst_port"] = packet[UDP].dport

        # In a real scenario, you would push this dictionary to a queue 
        # or a Redis instance for Member 2 to process.
        print(packet_data)

if __name__ == "__main__":
    sniff(prn=parse_packet, store=False)