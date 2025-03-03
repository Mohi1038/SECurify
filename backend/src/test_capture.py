import scapy.all as scapy
from datetime import datetime
import argparse
import sys
import time
import re
import winreg

def get_friendly_name(adapter_guid):
    """Get friendly name for a network adapter from Windows Registry"""
    try:
        # Convert GUID to registry format
        adapter_key = r"SYSTEM\CurrentControlSet\Control\Network\{4D36E972-E325-11CE-BFC1-08002BE10318}\{" + adapter_guid + r"}\Connection"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, adapter_key) as key:
            friendly_name = winreg.QueryValueEx(key, "Name")[0]
            return friendly_name
    except Exception:
        return None

def format_interface_name(interface):
    """Convert Windows NPF device name to friendly name"""
    # Extract GUID from NPF device name
    guid_match = re.search(r'{(.*?)}', interface)
    if guid_match:
        friendly_name = get_friendly_name(guid_match.group(1))
        if friendly_name:
            return friendly_name
    
    # Fallback names for common interfaces
    if "Loopback" in interface:
        return "Loopback (localhost)"
    if "NPF_" in interface:
        return interface.replace(r"\Device\NPF_", "")
    return interface

def get_interface_type(friendly_name):
    """Determine interface type from friendly name"""
    name_lower = friendly_name.lower()
    if "wi-fi" in name_lower or "wireless" in name_lower:
        return "Wi-Fi"
    elif "ethernet" in name_lower:
        return "Ethernet"
    elif "loopback" in name_lower:
        return "Loopback"
    elif "bluetooth" in name_lower:
        return "Bluetooth"
    elif "vpn" in name_lower:
        return "VPN"
    return "Other"

def get_available_interfaces():
    """Get list of available network interfaces"""
    try:
        interfaces = scapy.get_if_list()
        if not interfaces:
            print("No network interfaces found!")
            return []
        
        # Group interfaces by type
        grouped_interfaces = {}
        for iface in interfaces:
            friendly_name = format_interface_name(iface)
            iface_type = get_interface_type(friendly_name)
            if iface_type not in grouped_interfaces:
                grouped_interfaces[iface_type] = []
            ip = scapy.get_if_addr(iface)
            grouped_interfaces[iface_type].append((iface, friendly_name, ip))
        
        # Print grouped interfaces
        print("\nAvailable Network Interfaces:")
        print("-" * 60)
        
        interface_count = 1
        interface_mapping = {}
        
        for iface_type in sorted(grouped_interfaces.keys()):
            print(f"\n{iface_type} Interfaces:")
            print("-" * 30)
            
            for iface, friendly_name, ip in grouped_interfaces[iface_type]:
                ip_status = f"(IP: {ip})" if ip and ip != "0.0.0.0" else "(No IP)"
                print(f"{interface_count}. {friendly_name:<30} {ip_status}")
                interface_mapping[interface_count] = iface
                interface_count += 1
        
        print("-" * 60)
        return interface_mapping
    except Exception as e:
        print(f"Error getting interfaces: {str(e)}")
        return {}

def select_interface():
    """Let user select a network interface"""
    interface_mapping = get_available_interfaces()
    if not interface_mapping:
        return None
    
    if len(interface_mapping) == 1:
        iface = list(interface_mapping.values())[0]
        print(f"\nUsing only available interface: {format_interface_name(iface)}")
        return iface
    
    while True:
        try:
            choice = input("\nSelect interface number (or press Enter for default): ").strip()
            if not choice:  # Empty input - use default
                return None
            
            choice_num = int(choice)
            if choice_num in interface_mapping:
                selected_iface = interface_mapping[choice_num]
                print(f"\nSelected: {format_interface_name(selected_iface)}")
                return selected_iface
            print("Invalid selection. Please try again.")
        except ValueError:
            print("Please enter a valid number.")

def print_header():
    """Print formatted header"""
    print("\n" + "="*70)
    print("Network Traffic Monitor - Packet Capture Test")
    print("="*70 + "\n")

def format_packet_info(packet):
    """Format packet information for display"""
    info = []
    timestamp = datetime.fromtimestamp(packet.time).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    info.append(f"Time: {timestamp}")
    
    if packet.haslayer(scapy.IP):
        ip = packet[scapy.IP]
        info.extend([
            f"Source IP: {ip.src:>15} → Destination IP: {ip.dst:<15}",
            f"Protocol: {ip.proto} ({get_protocol_name(ip.proto)})"
        ])
        
        if packet.haslayer(scapy.TCP):
            tcp = packet[scapy.TCP]
            info.append(f"Ports: {tcp.sport:>5} → {tcp.dport:<5} [TCP] Flags: {tcp.flags}")
        elif packet.haslayer(scapy.UDP):
            udp = packet[scapy.UDP]
            info.append(f"Ports: {udp.sport:>5} → {udp.dport:<5} [UDP]")
    
    info.append(f"Length: {len(packet)} bytes")
    return info

def get_protocol_name(proto):
    """Convert protocol number to name"""
    protocols = {
        1: "ICMP",
        6: "TCP",
        17: "UDP"
    }
    return protocols.get(proto, str(proto))

def capture_test(packet_count=5, interface=None):
    """Capture and display network packets"""
    print_header()
    
    if interface is None:
        interface = select_interface()
    
    print(f"\nStarting capture...")
    print(f"Interface: {interface or 'default'}")
    print(f"Packet count: {packet_count}")
    print("-"*70)
    
    packets_captured = 0
    start_time = time.time()

    try:
        def packet_callback(packet):
            nonlocal packets_captured
            packets_captured += 1
            
            # Clear line and show progress
            sys.stdout.write('\r' + ' '*70 + '\r')
            print(f"\nPacket #{packets_captured}:")
            print('-'*30)
            
            for line in format_packet_info(packet):
                print(line)
            
            if packets_captured < packet_count:
                sys.stdout.write(f"Capturing... {packets_captured}/{packet_count}")
                sys.stdout.flush()

        # Start packet capture with shorter timeout
        scapy.sniff(
            prn=packet_callback,
            count=packet_count,
            timeout=10,  # Shorter timeout
            iface=interface,
            store=False  # Don't store packets in memory
        )
        
        # Show summary
        duration = time.time() - start_time
        print("\n" + "="*70)
        if packets_captured == 0:
            print("No packets captured! Please check:")
            print("1. Network interface selection")
            print("2. Network activity (try pinging a website)")
            print("3. Firewall settings")
        else:
            print(f"Capture completed: {packets_captured} packets in {duration:.2f} seconds")
        print("="*70)
        
    except KeyboardInterrupt:
        print("\n\nCapture interrupted by user.")
    except Exception as e:
        print(f"\nError during capture: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Run with administrator/root privileges")
        print("2. Verify Npcap/libpcap installation")
        print("3. Check network interface status")
        print("4. Try generating some network traffic (e.g., browse a website)")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test packet capture functionality")
    parser.add_argument("--count", type=int, default=5, help="Number of packets to capture")
    parser.add_argument("--interface", type=str, help="Network interface to capture from")
    args = parser.parse_args()
    
    capture_test(args.count, args.interface)
