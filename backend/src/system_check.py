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
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
            return (is_admin, "Admin privileges available" if is_admin else "Admin privileges required")
        else:
            is_admin = os.geteuid() == 0
            return (is_admin, "Root privileges available" if is_admin else "Root privileges required")
    except:
        return (False, "Failed to check admin privileges")

def check_npcap():
    """Check if Npcap is installed on Windows"""
    if platform.system() != 'Windows':
        return (True, "Not Windows system")
    
    try:
        interfaces = get_windows_if_list()
        if interfaces:
            return (True, "Npcap is installed and functional")
        return (False, "No network interfaces found")
    except Exception as e:
        return (False, f"Npcap check failed: {str(e)}")

def check_libpcap():
    """Check if libpcap is installed on Unix systems"""
    if platform.system() == 'Windows':
        return (True, "Not Unix system")
    
    try:
        result = subprocess.run(['whereis', 'libpcap'], capture_output=True, text=True)
        if 'libpcap:' in result.stdout and len(result.stdout.split()) > 1:
            return (True, "libpcap is installed")
        return (False, "libpcap not found")
    except Exception as e:
        return (False, f"libpcap check failed: {str(e)}")

def check_python_version():
    """Check if Python version meets requirements"""
    required_version = (3, 8)
    current_version = sys.version_info[:2]
    
    if current_version >= required_version:
        return (True, f"Python {'.'.join(map(str, current_version))} meets requirements")
    return (False, f"Python {'.'.join(map(str, required_version))} or higher required")

def check_network_access():
    """Check if we have access to network interfaces"""
    try:
        from scapy.all import get_if_list
        interfaces = get_if_list()
        if interfaces:
            return (True, f"Access to network interfaces: {', '.join(interfaces)}")
        return (False, "No network interfaces available")
    except Exception as e:
        return (False, f"Network access check failed: {str(e)}")

def run_all_checks():
    """Run all system requirement checks"""
    try:
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
        
    except Exception as e:
        print(f"Error in system checks: {str(e)}")
        return {
            "System Check": (False, f"Failed to complete system checks: {str(e)}")
        }

if __name__ == "__main__":
    try:
        results = run_all_checks()
        max_length = max(len(check) for check in results.keys())
        
        print("\nSystem Requirements Check:")
        print("=" * 50)
        
        all_passed = True
        error_messages = []
        
        for check, (status, message) in results.items():
            # Use ASCII characters instead of Unicode
            status_symbol = "OK" if status else "X"
            print(f"{check:<{max_length}} [{status_symbol}] {message}")
            if not status:
                all_passed = False
                error_messages.append(f"- {check}: {message}")
        
        print("=" * 50)
        
        if not all_passed:
            print("\nRequired Actions:")
            for msg in error_messages:
                print(msg)
            print("\nPlease fix these issues and try again.")
            sys.exit(1)
        else:
            print("\nAll system requirements met!")
            
    except Exception as e:
        print(f"Error during system check: {str(e)}")
        sys.exit(1)
