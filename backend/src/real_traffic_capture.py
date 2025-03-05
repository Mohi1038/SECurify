import scapy.all as scapy
import socket
import json
import time
import threading
import argparse
import os
import sys
from datetime import datetime
import psutil
import signal
import socket
from collections import defaultdict

# Add debug mode
DEBUG = True

# Store active connections
connections = {}
connection_lock = threading.Lock()

# Store DNS resolution cache
dns_cache = {}

# Add diagnostics
packet_stats = {
    "total_packets": 0,
    "tcp_packets": 0,
    "udp_packets": 0,
    "icmp_packets": 0,
    "other_packets": 0,
    "last_packet_time": None
}

# Class to represent a network connection
class Connection:
    def __init__(self, src_ip, dst_ip, src_port, dst_port, protocol):
        self.src_ip = src_ip
        self.dst_ip = dst_ip
        self.src_port = src_port
        self.dst_port = dst_port
        self.protocol = protocol
        self.service = self.determine_service()
        self.bytes_sent = 0
        self.bytes_received = 0
        self.packets_sent = 0
        self.packets_received = 0
        self.first_seen = datetime.now()
        self.last_seen = datetime.now()
        self.country = "Unknown"  # Would need GeoIP lookup
        self.asn = "Unknown"      # Would need ASN lookup
        self.domain = self.resolve_domain()
        self.active = True
        self.id = hash((src_ip, dst_ip, src_port, dst_port, protocol))

    def determine_service(self):
        if self.protocol == "ICMP":
            return "ICMP"
        
        # Well-known ports
        common_ports = {
            80: "HTTP",
            443: "HTTPS",
            53: "DNS",
            22: "SSH",
            21: "FTP",
            25: "SMTP",
            110: "POP3",
            143: "IMAP",
            3306: "MySQL",
            5432: "PostgreSQL",
            27017: "MongoDB",
            6379: "Redis",
            8080: "HTTP-ALT",
            8443: "HTTPS-ALT"
        }
        
        # Check if destination port is a common service
        if self.dst_port in common_ports:
            return common_ports[self.dst_port]
        
        # Check if source port is a common service
        if self.src_port in common_ports:
            return common_ports[self.src_port]
        
        return "Unknown"

    def resolve_domain(self):
        """Resolve IP address to domain name using DNS reverse lookup"""
        global dns_cache
        
        # Check cache for destination IP
        if self.dst_ip in dns_cache:
            return dns_cache[self.dst_ip]
        
        try:
            # Try to resolve destination IP to hostname
            domain = socket.gethostbyaddr(self.dst_ip)[0]
            dns_cache[self.dst_ip] = domain
            return domain
        except (socket.herror, socket.gaierror):
            # No domain found, check for source IP
            if self.src_ip in dns_cache:
                return dns_cache[self.src_ip]
            
            try:
                domain = socket.gethostbyaddr(self.src_ip)[0]
                dns_cache[self.src_ip] = domain
                return domain
            except (socket.herror, socket.gaierror):
                dns_cache[self.dst_ip] = ""
                dns_cache[self.src_ip] = ""
                return ""

    def update(self, packet_size, is_outgoing):
        self.last_seen = datetime.now()
        
        if is_outgoing:
            self.bytes_sent += packet_size
            self.packets_sent += 1
        else:
            self.bytes_received += packet_size
            self.packets_received += 1

    def to_dict(self):
        return {
            "id": self.id,
            "srcAddr": self.src_ip,
            "srcPort": self.src_port,
            "dstAddr": self.dst_ip,
            "dstPort": self.dst_port,
            "protocol": self.protocol,
            "service": self.service,
            "bytes": self.bytes_sent + self.bytes_received,
            "packets": self.packets_sent + self.packets_received,
            "domain": self.domain,
            "country": self.country,
            "asn": self.asn,
            "firstSeen": self.first_seen.isoformat(),
            "lastSeen": self.last_seen.isoformat(),
            "active": self.active
        }

# Get local IP addresses
def get_local_ips():
    local_ips = set()
    for interface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:  # IPv4
                local_ips.add(addr.address)
    return local_ips

# Packet handler function
def packet_handler(packet, local_ips):
    # Update diagnostics
    packet_stats["total_packets"] += 1
    packet_stats["last_packet_time"] = datetime.now()
    
    if DEBUG:
        print(f"Received packet: {packet.summary()}")
    
    if scapy.IP not in packet:
        if DEBUG:
            print("Not an IP packet, skipping")
        return
    
    ip_packet = packet[scapy.IP]
    src_ip = ip_packet.src
    dst_ip = ip_packet.dst
    
    # Determine protocol and ports
    if scapy.TCP in packet:
        packet_stats["tcp_packets"] += 1
        protocol = "TCP"
        src_port = packet[scapy.TCP].sport
        dst_port = packet[scapy.TCP].dport
        if DEBUG:
            print(f"TCP: {src_ip}:{src_port} -> {dst_ip}:{dst_port}")
    elif scapy.UDP in packet:
        packet_stats["udp_packets"] += 1
        protocol = "UDP"
        src_port = packet[scapy.UDP].sport
        dst_port = packet[scapy.UDP].dport
        if DEBUG:
            print(f"UDP: {src_ip}:{src_port} -> {dst_ip}:{dst_port}")
    elif scapy.ICMP in packet:
        packet_stats["icmp_packets"] += 1
        protocol = "ICMP"
        src_port = 0
        dst_port = 0
        if DEBUG:
            print(f"ICMP: {src_ip} -> {dst_ip}")
    else:
        # Skip other protocols
        packet_stats["other_packets"] += 1
        if DEBUG:
            print(f"Other protocol: {ip_packet.proto}")
        return

    # Determine if packet is outgoing or incoming
    is_outgoing = src_ip in local_ips
    
    # Create a unique connection identifier
    if is_outgoing:
        conn_id = (src_ip, dst_ip, src_port, dst_port, protocol)
    else:
        conn_id = (dst_ip, src_ip, dst_port, src_port, protocol)
    
    # Get packet size
    packet_size = len(packet)
    
    with connection_lock:
        if conn_id not in connections:
            # Create new connection
            if is_outgoing:
                conn = Connection(src_ip, dst_ip, src_port, dst_port, protocol)
            else:
                conn = Connection(dst_ip, src_ip, dst_port, src_port, protocol)
            connections[conn_id] = conn
            if DEBUG:
                print(f"New connection: {conn_id}")
        
        # Update existing connection
        connections[conn_id].update(packet_size, is_outgoing)

def start_capture(interface=None, duration=None):
    # Get local IP addresses
    local_ips = get_local_ips()
    print(f"Local IPs: {local_ips}")
    
    # Start packet capture in a separate thread
    def capture_thread():
        try:
            # Try to create a test packet to verify capture works
            test_packet = scapy.IP(dst="8.8.8.8")/scapy.ICMP()
            if DEBUG:
                print("Testing packet creation:", test_packet.summary())
                print(f"Starting capture on {'all interfaces' if interface is None else interface}")
            
            # Fix for Windows/macOS: If no specific interface, try to find one that works
            if interface is None and scapy.conf.iface is None:
                print("No default interface set, trying to find working interface...")
                for iface_name in scapy.get_if_list():
                    try:
                        print(f"Testing interface: {iface_name}")
                        # Try to send a dummy packet on this interface to test it
                        scapy.send(test_packet, iface=iface_name, verbose=0, count=1)
                        print(f"Using interface: {iface_name}")
                        interface = iface_name
                        break
                    except Exception as e:
                        print(f"Interface {iface_name} error: {str(e)}")
            
            print(f"Starting packet capture on {'all interfaces' if interface is None else interface}")
            # Use promisc=True to capture all packets
            scapy.sniff(
                iface=interface,
                prn=lambda pkt: packet_handler(pkt, local_ips),
                store=False,
                timeout=duration,
                promisc=True
            )
        except Exception as e:
            print(f"Capture error: {str(e)}")
    
    thread = threading.Thread(target=capture_thread)
    thread.daemon = True
    thread.start()
    
    print(f"Started capturing on {'all interfaces' if interface is None else interface}")
    return thread

def get_connections_json():
    with connection_lock:
        # Convert connections to list of dictionaries
        conn_list = [conn.to_dict() for conn in connections.values()]
    
    # Sort by last seen time (most recent first)
    conn_list.sort(key=lambda x: x["lastSeen"], reverse=True)
    
    # Add diagnostics
    if DEBUG:
        diagnostics = {
            "total_packets": packet_stats["total_packets"],
            "tcp_packets": packet_stats["tcp_packets"],
            "udp_packets": packet_stats["udp_packets"],
            "icmp_packets": packet_stats["icmp_packets"],
            "other_packets": packet_stats["other_packets"],
            "last_packet_time": packet_stats["last_packet_time"].isoformat() if packet_stats["last_packet_time"] else None
        }
        return json.dumps({
            "connections": conn_list,
            "diagnostics": diagnostics
        })
        
    return json.dumps(conn_list)

# Generate simulated traffic for testing
def generate_simulated_traffic():
    print("Generating simulated traffic for testing")
    
    # Common services and ports
    services = {
        "HTTP": 80,
        "HTTPS": 443,
        "DNS": 53,
        "SSH": 22
    }
    
    # Popular websites
    websites = [
        {"domain": "google.com", "ip": "142.250.190.78"},
        {"domain": "youtube.com", "ip": "142.250.190.110"},
        {"domain": "facebook.com", "ip": "157.240.3.35"},
        {"domain": "twitter.com", "ip": "104.244.42.1"},
        {"domain": "github.com", "ip": "140.82.121.4"}
    ]
    
    # Get local IPs
    local_ips = list(get_local_ips())
    if not local_ips:
        local_ips = ["192.168.1.100"]  # Fallback if no local IPs
        
    # Create simulated connections
    simulated_count = 10
    for i in range(simulated_count):
        source_ip = local_ips[0]  # Use first local IP
        website = websites[i % len(websites)]
        dest_ip = website["ip"]
        dest_domain = website["domain"]
        
        # Alternate between TCP and UDP
        protocol = "TCP" if i % 3 != 0 else "UDP"
        
        # Choose a service
        service_name = list(services.keys())[i % len(services)]
        dest_port = services[service_name]
        
        # Random source port
        source_port = 50000 + i
        
        # Create a connection
        conn_id = (source_ip, dest_ip, source_port, dest_port, protocol)
        
        # Create connection object
        conn = Connection(source_ip, dest_ip, source_port, dest_port, protocol)
        
        # Override domain resolution
        conn.domain = dest_domain
        
        # Set bytes and packets
        bytes_count = 10000 * (i + 1)
        packets_count = bytes_count // 1000
        conn.bytes_sent = bytes_count // 2
        conn.bytes_received = bytes_count // 2
        conn.packets_sent = packets_count // 2
        conn.packets_received = packets_count // 2
        
        # Store the connection
        with connection_lock:
            connections[conn_id] = conn
            
    print(f"Created {simulated_count} simulated connections")

def cleanup_old_connections(max_age_seconds=3600):  # Default 1 hour
    """Remove inactive connections older than max_age_seconds"""
    with connection_lock:
        current_time = datetime.now()
        conn_ids_to_remove = []
        
        for conn_id, conn in connections.items():
            age = (current_time - conn.last_seen).total_seconds()
            if age > max_age_seconds:
                conn_ids_to_remove.append(conn_id)
        
        # Remove old connections
        for conn_id in conn_ids_to_remove:
            del connections[conn_id]
        
        return len(conn_ids_to_remove)

def run_cleanup_thread(cleanup_interval=300):  # Clean every 5 minutes
    """Run a background thread to clean up old connections"""
    def cleanup_thread():
        while True:
            removed = cleanup_old_connections()
            if removed > 0:
                print(f"Removed {removed} old connections")
            time.sleep(cleanup_interval)
    
    thread = threading.Thread(target=cleanup_thread)
    thread.daemon = True
    thread.start()

def main():
    parser = argparse.ArgumentParser(description='Capture and analyze network traffic')
    parser.add_argument('--interface', '-i', help='Network interface to capture')
    parser.add_argument('--output', '-o', help='Output file for connections')
    parser.add_argument('--time', '-t', type=int, help='Capture duration in seconds')
    parser.add_argument('--serve', '-s', action='store_true', help='Run HTTP server for realtime data')
    parser.add_argument('--port', '-p', type=int, default=8000, help='HTTP server port (default: 8000)')
    parser.add_argument('--simulate', action='store_true', help='Generate simulated traffic for testing')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()
    
    global DEBUG
    DEBUG = args.debug
    
    print("Starting network traffic capture...")
    
    # Handle Ctrl+C
    def signal_handler(sig, frame):
        print("\nStopping capture...")
        if args.output:
            with open(args.output, 'w') as f:
                f.write(get_connections_json())
            print(f"Saved {len(connections)} connections to {args.output}")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # Use simulated traffic if requested
    if args.simulate:
        generate_simulated_traffic()
    else:
        # Start capture thread
        capture_thread = start_capture(args.interface, args.time)
    
    # Start cleanup thread
    run_cleanup_thread()
    
    if args.serve:
        # Simple HTTP server for debugging
        from http.server import HTTPServer, BaseHTTPRequestHandler
        
        class SimpleHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/connections':
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    # If no connections and debug mode, generate simulated ones
                    if len(connections) == 0 and DEBUG:
                        generate_simulated_traffic()
                    
                    self.wfile.write(get_connections_json().encode())
                elif self.path == '/stats':
                    # Add a stats endpoint for diagnostics
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    stats = {
                        "connections": len(connections),
                        "packets": packet_stats
                    }
                    self.wfile.write(json.dumps(stats).encode())
                else:
                    self.send_response(404)
                    self.end_headers()
                    
            def log_message(self, format, *args):
                # Suppress excessive logging for cleaner output
                if DEBUG:
                    super().log_message(format, *args)
        
        try:
            # Use 0.0.0.0 to listen on all interfaces (both IPv4 and IPv6)
            server = HTTPServer(('0.0.0.0', args.port), SimpleHandler)
            print(f"HTTP server started at http://localhost:{args.port}/connections")
            print(f"Diagnostic stats available at http://localhost:{args.port}/stats")
            server.serve_forever()
        except Exception as e:
            print(f"Failed to start HTTP server: {str(e)}")
            sys.exit(1)
    else:
        # Wait for capture to complete
        if not args.simulate:
            capture_thread.join()
        
        # Save output if specified
        if args.output:
            with open(args.output, 'w') as f:
                f.write(get_connections_json())
            print(f"Saved {len(connections)} connections to {args.output}")
        else:
            print(get_connections_json())

if __name__ == "__main__":
    main()
