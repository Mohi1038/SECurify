import os
import sys
import platform
import ctypes
import subprocess
from scapy.arch import get_windows_if_list

def is_admin():
    """Check if the program has admin privileges"""
    try:
        if platform.system() == 'Windows':
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        else:
            return os.geteuid() == 0
    except:
        return False

def check_npcap():
    """Check if Npcap is installed on Windows"""
    if platform.system() != 'Windows':
        return True, "Not Windows system"
    
    try:
        interfaces = get_windows_if_list()
        if interfaces:
            return True, "Npcap is installed and functional"
        return False, "No network interfaces found"
    except Exception as e:
        return False, f"Npcap check failed: {str(e)}"

def check_libpcap():
    """Check if libpcap is installed on Unix systems"""
    if platform.system() == 'Windows':
        return True, "Not Unix system"
    
    try:
        result = subprocess.run(['whereis', 'libpcap'], capture_output=True, text=True)
        if 'libpcap:' in result.stdout and len(result.stdout.split()) > 1:
            return True, "libpcap is installed"
        return False, "libpcap not found"
    except Exception as e:
        return False, f"libpcap check failed: {str(e)}"

def check_python_version():
    """Check if Python version meets requirements"""
    required_version = (3, 8)
    current_version = sys.version_info[:2]
    
    if current_version >= required_version:
        return True, f"Python {'.'.join(map(str, current_version))} meets requirements"
    return False, f"Python {'.'.join(map(str, required_version))} or higher required"

def check_network_access():
    """Check if we have access to network interfaces"""
    try:
        from scapy.all import get_if_list
        interfaces = get_if_list()
        if interfaces:
            return True, f"Access to network interfaces: {', '.join(interfaces)}"
        return False, "No network interfaces available"
    except Exception as e:
        return False, f"Network access check failed: {str(e)}"

def run_all_checks():
    """Run all system requirement checks"""
    checks = {
        "Admin Rights": is_admin(),
        "Python Version": check_python_version(),
        "Network Access": check_network_access()
    }
    
    if platform.system() == 'Windows':
        checks["Npcap"] = check_npcap()
    else:
        checks["libpcap"] = check_libpcap()
    
    return checks

if __name__ == "__main__":
    results = run_all_checks()
    max_length = max(len(check) for check in results.keys())
    
    print("\nSystem Requirements Check:")
    print("=" * 50)
    for check, (status, message) in results.items():
        status_symbol = "✓" if status else "✗"
        print(f"{check:<{max_length}} [{status_symbol}] {message}")
    print("=" * 50)
    
    # Exit with error if any check failed
    if not all(status for status, _ in results.values()):
        sys.exit(1)
