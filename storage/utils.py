import json
import os
from datetime import datetime
from pathlib import Path

class StorageManager:
    def __init__(self, storage_dir='data'):
        self.storage_dir = Path(__file__).parent / storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save_capture(self, packets, filename=None):
        """Save captured packets to JSON file"""
        if filename is None:
            filename = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = self.storage_dir / filename
        
        # Convert packet data to serializable format
        packet_data = [self._prepare_packet(p) for p in packets]
        
        with open(filepath, 'w') as f:
            json.dump(packet_data, f, indent=2, default=str)
        
        return str(filepath)

    def load_capture(self, filename):
        """Load captured packets from JSON file"""
        filepath = self.storage_dir / filename
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return None

    def list_captures(self):
        """List all capture files"""
        return [f.name for f in self.storage_dir.glob('*.json')]

    def _prepare_packet(self, packet_data):
        """Prepare packet data for JSON serialization"""
        # Convert datetime objects to ISO format strings
        if isinstance(packet_data.get('time'), datetime):
            packet_data['time'] = packet_data['time'].isoformat()
        return packet_data
