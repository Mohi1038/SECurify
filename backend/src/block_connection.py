#!/usr/bin/env python3
"""
Script to block or unblock network connections using the firewall manager.
"""

import argparse
import json
import sys
from firewall_manager import FirewallManager

def main():
    parser = argparse.ArgumentParser(description='Block or unblock network connections.')
    
    # Common options
    parser.add_argument('--list', action='store_true', help='List all blocked connections')
    
    # Block connection options
    parser.add_argument('--source-ip', help='Source IP address')
    parser.add_argument('--source-port', type=int, help='Source port')
    parser.add_argument('--dest-ip', help='Destination IP address')
    parser.add_argument('--dest-port', type=int, help='Destination port')
    parser.add_argument('--protocol', help='Protocol (TCP, UDP, ICMP)')
    
    # Unblock connection option
    parser.add_argument('--unblock', action='store_true', help='Unblock a connection')
    parser.add_argument('--rule-id', help='Rule ID to unblock')
    
    args = parser.parse_args()
    
    # Initialize the firewall manager
    firewall = FirewallManager()
    
    # Handle command based on arguments
    try:
        if args.list:
            # List all blocked connections
            blocked_connections = firewall.get_blocked_connections()
            print(json.dumps({
                "success": True,
                "blockedConnections": list(blocked_connections.values())
            }))
            return 0
        
        elif args.unblock and args.rule_id:
            # Unblock a connection
            result = firewall.unblock_connection(args.rule_id)
            print(json.dumps(result))
            return 0 if result["success"] else 1
        
        elif args.source_ip or args.dest_ip:
            # Block a new connection
            source_ip = args.source_ip or "any"
            source_port = args.source_port or 0
            dest_ip = args.dest_ip or "any"
            dest_port = args.dest_port or 0
            protocol = (args.protocol or "TCP").upper()
            
            # Validate protocol
            if protocol not in ["TCP", "UDP", "ICMP"]:
                print(json.dumps({
                    "success": False,
                    "message": f"Unsupported protocol: {protocol}. Use TCP, UDP, or ICMP."
                }))
                return 1
            
            # Block the connection
            result = firewall.block_connection(source_ip, source_port, dest_ip, dest_port, protocol)
            print(json.dumps(result))
            return 0 if result["success"] else 1
        
        else:
            # Invalid arguments
            print(json.dumps({
                "success": False,
                "message": "Invalid arguments. Use --help for usage information."
            }))
            return 1
    
    except Exception as e:
        print(json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))
        return 1

if __name__ == "__main__":
    sys.exit(main())
