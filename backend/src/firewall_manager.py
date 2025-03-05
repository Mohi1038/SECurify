import platform
import subprocess
import uuid
import os
import json
import logging
from datetime import datetime  # Add this missing import

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('firewall_manager')

# Store blocked rules for management
RULES_FILE = os.path.join(os.path.dirname(__file__), 'blocked_rules.json')

def load_blocked_rules():
    """Load previously blocked rules from file"""
    try:
        if os.path.exists(RULES_FILE):
            with open(RULES_FILE, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        logger.error(f"Failed to load blocked rules: {str(e)}")
        return {}

def save_blocked_rules(rules):
    """Save blocked rules to file"""
    try:
        with open(RULES_FILE, 'w') as f:
            json.dump(rules, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save blocked rules: {str(e)}")

# Global rules storage
blocked_rules = load_blocked_rules()

class FirewallManager:
    def __init__(self):
        self.os_type = platform.system()
        logger.info(f"FirewallManager initialized on {self.os_type}")
    
    def block_connection(self, source_ip, source_port, dest_ip, dest_port, protocol):
        """Block a connection based on its parameters"""
        try:
            # Generate a unique rule ID
            rule_id = str(uuid.uuid4())
            
            # Create rule description
            rule_name = f"SECurify_Block_{source_ip}_{source_port}_to_{dest_ip}_{dest_port}_{protocol}"
            
            if self.os_type == "Windows":
                success = self._block_on_windows(rule_name, source_ip, source_port, dest_ip, dest_port, protocol)
            elif self.os_type == "Linux":
                success = self._block_on_linux(rule_name, source_ip, source_port, dest_ip, dest_port, protocol)
            elif self.os_type == "Darwin":  # macOS
                success = self._block_on_macos(rule_name, source_ip, source_port, dest_ip, dest_port, protocol)
            else:
                logger.error(f"Unsupported OS: {self.os_type}")
                return {"success": False, "message": f"Unsupported OS: {self.os_type}"}
            
            if success:
                # Store rule information
                blocked_rules[rule_id] = {
                    "id": rule_id,
                    "name": rule_name,
                    "source_ip": source_ip,
                    "source_port": source_port,
                    "dest_ip": dest_ip,
                    "dest_port": dest_port,
                    "protocol": protocol,
                    "created_at": str(datetime.now())
                }
                save_blocked_rules(blocked_rules)
                
                logger.info(f"Successfully blocked connection: {source_ip}:{source_port} to {dest_ip}:{dest_port} ({protocol})")
                return {"success": True, "rule_id": rule_id}
            else:
                return {"success": False, "message": "Failed to create firewall rule"}
            
        except Exception as e:
            logger.exception(f"Error blocking connection: {str(e)}")
            return {"success": False, "message": str(e)}
    
    def unblock_connection(self, rule_id):
        """Unblock a previously blocked connection by rule ID"""
        try:
            if rule_id not in blocked_rules:
                logger.error(f"Rule ID not found: {rule_id}")
                return {"success": False, "message": "Rule ID not found"}
            
            rule = blocked_rules[rule_id]
            rule_name = rule["name"]
            
            if self.os_type == "Windows":
                success = self._unblock_on_windows(rule_name)
            elif self.os_type == "Linux":
                success = self._unblock_on_linux(rule, rule_name)
            elif self.os_type == "Darwin":  # macOS
                success = self._unblock_on_macos(rule, rule_name)
            else:
                logger.error(f"Unsupported OS: {self.os_type}")
                return {"success": False, "message": f"Unsupported OS: {self.os_type}"}
            
            if success:
                # Remove rule from storage
                del blocked_rules[rule_id]
                save_blocked_rules(blocked_rules)
                
                logger.info(f"Successfully unblocked connection for rule: {rule_name}")
                return {"success": True}
            else:
                return {"success": False, "message": "Failed to remove firewall rule"}
            
        except Exception as e:
            logger.exception(f"Error unblocking connection: {str(e)}")
            return {"success": False, "message": str(e)}
    
    def _block_on_windows(self, rule_name, source_ip, source_port, dest_ip, dest_port, protocol):
        """Create a Windows Firewall rule to block the connection"""
        try:
            # Convert protocol to Windows Firewall format
            proto = protocol.lower()
            if proto not in ["tcp", "udp", "icmp"]:
                logger.error(f"Unsupported protocol for Windows Firewall: {protocol}")
                return False
            
            # Create outbound rule
            outbound_cmd = [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={rule_name}_out",
                "dir=out",
                "action=block",
                f"protocol={proto}"
            ]
            
            # Add IP and port parameters
            if source_ip != "any":
                outbound_cmd.append(f"localip={source_ip}")
            if source_port != "any" and source_port != 0:
                outbound_cmd.append(f"localport={source_port}")
            if dest_ip != "any":
                outbound_cmd.append(f"remoteip={dest_ip}")
            if dest_port != "any" and dest_port != 0:
                outbound_cmd.append(f"remoteport={dest_port}")
                
            # Create inbound rule
            inbound_cmd = [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={rule_name}_in",
                "dir=in",
                "action=block",
                f"protocol={proto}"
            ]
            
            # Add IP and port parameters for inbound
            if dest_ip != "any":
                inbound_cmd.append(f"localip={dest_ip}")
            if dest_port != "any" and dest_port != 0:
                inbound_cmd.append(f"localport={dest_port}")
            if source_ip != "any":
                inbound_cmd.append(f"remoteip={source_ip}")
            if source_port != "any" and source_port != 0:
                inbound_cmd.append(f"remoteport={source_port}")
                
            # Execute commands
            subprocess.run(outbound_cmd, check=True, capture_output=True)
            subprocess.run(inbound_cmd, check=True, capture_output=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create Windows Firewall rule: {e.stderr.decode()}")
            return False
        except Exception as e:
            logger.exception(f"Error in _block_on_windows: {str(e)}")
            return False
    
    def _block_on_linux(self, rule_name, source_ip, source_port, dest_ip, dest_port, protocol):
        """Create iptables rules to block the connection"""
        try:
            # Convert protocol to iptables format
            proto = protocol.lower()
            if proto not in ["tcp", "udp", "icmp"]:
                logger.error(f"Unsupported protocol for iptables: {protocol}")
                return False
                
            # Build the iptables commands
            cmds = []
            comment = f"SECurify block {source_ip}:{source_port}-{dest_ip}:{dest_port}"
            
            # Outbound rule
            outbound_cmd = ["iptables", "-A", "OUTPUT"]
            if source_ip != "any":
                outbound_cmd.extend(["-s", source_ip])
            if source_port != "any" and source_port != 0 and proto in ["tcp", "udp"]:
                outbound_cmd.extend(["--sport", str(source_port)])
            if dest_ip != "any":
                outbound_cmd.extend(["-d", dest_ip])
            if dest_port != "any" and dest_port != 0 and proto in ["tcp", "udp"]:
                outbound_cmd.extend(["--dport", str(dest_port)])
            outbound_cmd.extend(["-p", proto, "-j", "DROP", "-m", "comment", "--comment", comment])
            cmds.append(outbound_cmd)
            
            # Inbound rule
            inbound_cmd = ["iptables", "-A", "INPUT"]
            if dest_ip != "any":
                inbound_cmd.extend(["-d", dest_ip])
            if dest_port != "any" and dest_port != 0 and proto in ["tcp", "udp"]:
                inbound_cmd.extend(["--dport", str(dest_port)])
            if source_ip != "any":
                inbound_cmd.extend(["-s", source_ip])
            if source_port != "any" and source_port != 0 and proto in ["tcp", "udp"]:
                inbound_cmd.extend(["--sport", str(source_port)])
            inbound_cmd.extend(["-p", proto, "-j", "DROP", "-m", "comment", "--comment", comment])
            cmds.append(inbound_cmd)
            
            # Execute commands
            for cmd in cmds:
                subprocess.run(cmd, check=True, capture_output=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create iptables rule: {e.stderr.decode()}")
            return False
        except Exception as e:
            logger.exception(f"Error in _block_on_linux: {str(e)}")
            return False
    
    def _block_on_macos(self, rule_name, source_ip, source_port, dest_ip, dest_port, protocol):
        """Create pf rules to block the connection on macOS"""
        try:
            # For macOS, we'll use the pfctl system
            # This is a simplified version and may need further refinement
            
            # Convert protocol to pf format
            proto = protocol.lower()
            if proto not in ["tcp", "udp", "icmp"]:
                logger.error(f"Unsupported protocol for pf: {protocol}")
                return False
            
            # Create rule string
            rule = f"block out proto {proto} "
            
            if source_ip != "any":
                rule += f"from {source_ip} "
            else:
                rule += "from any "
                
            if source_port != "any" and source_port != 0 and proto in ["tcp", "udp"]:
                rule += f"port {source_port} "
                
            if dest_ip != "any":
                rule += f"to {dest_ip} "
            else:
                rule += "to any "
                
            if dest_port != "any" and dest_port != 0 and proto in ["tcp", "udp"]:
                rule += f"port {dest_port} "
                
            # Write to temporary file
            temp_file = f"/tmp/secruify_pf_rule_{rule_name}.conf"
            with open(temp_file, "w") as f:
                f.write(rule)
            
            # Add rule to pf
            subprocess.run(["pfctl", "-a", f"com.secruify/{rule_name}", "-f", temp_file], 
                          check=True, capture_output=True)
            
            # Remove temp file
            os.remove(temp_file)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create pf rule: {e.stderr.decode()}")
            return False
        except Exception as e:
            logger.exception(f"Error in _block_on_macos: {str(e)}")
            return False
    
    def _unblock_on_windows(self, rule_name):
        """Remove a Windows Firewall rule"""
        try:
            # Remove outbound rule
            outbound_cmd = [
                "netsh", "advfirewall", "firewall", "delete", "rule",
                f"name={rule_name}_out"
            ]
            
            # Remove inbound rule
            inbound_cmd = [
                "netsh", "advfirewall", "firewall", "delete", "rule",
                f"name={rule_name}_in"
            ]
            
            # Execute commands
            subprocess.run(outbound_cmd, check=True, capture_output=True)
            subprocess.run(inbound_cmd, check=True, capture_output=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to delete Windows Firewall rule: {e.stderr.decode()}")
            return False
        except Exception as e:
            logger.exception(f"Error in _unblock_on_windows: {str(e)}")
            return False
    
    def _unblock_on_linux(self, rule, rule_name):
        """Remove iptables rules"""
        try:
            source_ip = rule["source_ip"]
            source_port = rule["source_port"]
            dest_ip = rule["dest_ip"]
            dest_port = rule["dest_port"]
            protocol = rule["protocol"]
            proto = protocol.lower()
            
            comment = f"SECurify block {source_ip}:{source_port}-{dest_ip}:{dest_port}"
            
            # Find and delete rules with matching comment
            # First get all rules
            output = subprocess.run(["iptables-save"], check=True, capture_output=True, text=True)
            rules = output.stdout.splitlines()
            
            # Find rule numbers with our comment
            for chain in ["INPUT", "OUTPUT"]:
                # List rules with line numbers
                list_cmd = ["iptables", "-L", chain, "--line-numbers"]
                output = subprocess.run(list_cmd, check=True, capture_output=True, text=True)
                
                # Parse output to find rule numbers with our comment
                lines = output.stdout.splitlines()
                rule_numbers = []
                
                for line in lines:
                    if comment in line:
                        parts = line.split()
                        if parts and parts[0].isdigit():
                            rule_numbers.append(int(parts[0]))
                
                # Delete rules in reverse order to avoid changing rule numbers
                for num in sorted(rule_numbers, reverse=True):
                    delete_cmd = ["iptables", "-D", chain, str(num)]
                    subprocess.run(delete_cmd, check=True, capture_output=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to delete iptables rule: {e.stderr.decode()}")
            return False
        except Exception as e:
            logger.exception(f"Error in _unblock_on_linux: {str(e)}")
            return False
    
    def _unblock_on_macos(self, rule, rule_name):
        """Remove pf rules on macOS"""
        try:
            # Remove the anchor containing our rule
            subprocess.run(["pfctl", "-a", f"com.secruify/{rule_name}", "-F", "all"], 
                          check=True, capture_output=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to delete pf rule: {e.stderr.decode()}")
            return False
        except Exception as e:
            logger.exception(f"Error in _unblock_on_macos: {str(e)}")
            return False
    
    def get_blocked_connections(self):
        """Get all blocked connections"""
        return blocked_rules

# To use in other files:
# from firewall_manager import FirewallManager
# 
# firewall = FirewallManager()
# result = firewall.block_connection("192.168.1.100", 12345, "8.8.8.8", 53, "UDP")