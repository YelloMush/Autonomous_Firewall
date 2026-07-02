import time
import requests
import platform
import subprocess
import traceback
from scapy.all import sniff, IP, show_interfaces, IFACES

class NetworkNode:
    def __init__(self):
        self.os_type = platform.system()
        print("System detected:", self.os_type)

    def block_ip(self, target_ip):
        print("ATTEMPTING TO BLOCK MALICIOUS IP:", target_ip)
        try:
            if self.os_type == "Windows":
                cmd = 'netsh advfirewall firewall add rule name="Block_' + target_ip + '" dir=in action=block remoteip=' + target_ip
                subprocess.run(cmd, shell=True, check=True)
                print("SUCCESS:", target_ip, "blocked via Windows Firewall.")
        except Exception as e:
            print("ERROR: Failed to block IP. Details:", e)

    def parse_packet(self, packet):
        if packet.haslayer(IP):
            packet_data = dict(
                timestamp=time.time(),
                src_ip=packet.getlayer(IP).src,
                dst_ip=packet.getlayer(IP).dst,
                length=len(packet),
                protocol="OTHER"
            )
            try:
                # Send the packet data to Member 3's API
                requests.post("http://127.0.0.1:8000/ingest_packet", json=packet_data, timeout=0.1)
                print(f"Sent packet from {packet_data['src_ip']} to Database")
            except requests.exceptions.RequestException:
                print("WARNING: Could not connect to API. Is the server running?")

if __name__ == "__main__":
    node = NetworkNode()
    
    while True:
        print("\nAvailable Interfaces:")
        show_interfaces()
        
        user_input = input("\nType the exact Index number of your active internet interface: ")
        
        try:
            device_index = int(user_input)
            active_interface = IFACES.dev_from_index(device_index)
            print("Starting sniffer on", active_interface.name, "... Press Ctrl+C to stop.")
            
            sniff(iface=active_interface, prn=node.parse_packet, store=False)
            
        except KeyboardInterrupt:
            print("\nSniffing stopped by user.")
        except ValueError:
            print("\nERROR: You must type a valid integer index number.")
        except Exception as e:
            print("\nCRITICAL FAILURE:")
            traceback.print_exc()
        
        choice = input("\nDo you want to sniff another device? (y/n): ")
        if choice.lower() != 'y':
            print("Exiting program.")
            break