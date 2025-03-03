import scapy.all as scapy
from datetime import datetime
import sys
import os
from .system_check import run_all_checks

# Add project root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from storage.utils import StorageManager

class PacketCapture:
    def __init__(self):
        self.storage = StorageManager()
        self.captured_packets = []
        self.validate_system()

    def validate_system(self):
        """Validate system requirements before capturing"""
        checks = run_all_checks()
        failed_checks = {
            check: message
            for check, (status, message) in checks.items()
            if not status
        }
        
        if failed_checks:
            error_msg = "\n".join(
                f"- {check}: {message}"
                for check, message in failed_checks.items()
            )
            raise RuntimeError(
                f"System requirements not met:\n{error_msg}\n"
                "Please check the setup guide for requirements."
            )

    def capture_packets(self, interface=None, count=10):
        """Capture network packets"""
        try:
            self.validate_system()  # Re-check before capture
            packets = scapy.sniff(iface=interface, count=count)
            self.captured_packets = [self.analyze_packet(p) for p in packets]
            return self.captured_packets
        except Exception as e:
            raise RuntimeError(f"Packet capture failed: {str(e)}")

    def analyze_packet(self, packet):
        """Extract key information from a packet"""
        packet_info = {
            'time': packet.time,
            'length': len(packet),
            'protocol': None,
            'src_ip': None,
            'dst_ip': None,
            'src_port': None,
            'dst_port': None
        }
        
        # Extract IP layer information if present
        if packet.haslayer(scapy.IP):
            packet_info['protocol'] = packet[scapy.IP].proto
            packet_info['src_ip'] = packet[scapy.IP].src
            packet_info['dst_ip'] = packet[scapy.IP].dst
            
            # Extract TCP/UDP port information if present
            if packet.haslayer(scapy.TCP):
                packet_info['src_port'] = packet[scapy.TCP].sport
                packet_info['dst_port'] = packet[scapy.TCP].dport
            elif packet.haslayer(scapy.UDP):
                packet_info['src_port'] = packet[scapy.UDP].sport
                packet_info['dst_port'] = packet[scapy.UDP].dport
        
        return packet_info

    def save_capture(self, filename=None):
        """Save the current capture to storage"""
        if not self.captured_packets:
            return None
        return self.storage.save_capture(self.captured_packets, filename)

    def load_capture(self, filename):
        """Load a previous capture from storage"""
        return self.storage.load_capture(filename)

    def list_captures(self):
        """List all available captures"""
        return self.storage.list_captures()

if __name__ == "__main__":
    # Test packet capture and storage
    capture = PacketCapture()
    packets = capture.capture_packets(count=5)
    
    # Save the capture
    save_path = capture.save_capture()
    print(f"Capture saved to: {save_path}")
    
    # List available captures
    captures = capture.list_captures()
    print(f"Available captures: {captures}")
