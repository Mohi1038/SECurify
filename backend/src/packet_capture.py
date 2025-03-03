import scapy.all as scapy

def capture_packets(interface=None, count=10):
    """
    Capture network packets
    
    Args:
        interface: Network interface to capture packets from
        count: Number of packets to capture
    
    Returns:
        List of captured packets
    """
    packets = scapy.sniff(iface=interface, count=count)
    return packets

def analyze_packet(packet):
    """
    Extract key information from a packet
    
    Args:
        packet: A scapy packet object
    
    Returns:
        Dictionary with packet information
    """
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

if __name__ == "__main__":
    # Test packet capture
    packets = capture_packets(count=5)
    for packet in packets:
        info = analyze_packet(packet)
        print(info)
