import json
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any
import pandas as pd

from models import ParsedData, StandardizedMessage, StandardizedCall, StandardizedContact

class UFDRParser:
    """Parser for generic UFDR files (JSON, XML, CSV)"""
    
    def __init__(self):
        self.device_info = {}
        self.messages = []
        self.calls = []
        self.contacts = []
    
    async def parse_file(self, file_path: str) -> ParsedData:
        """Parse UFDR file and return standardized data"""
        
        try:
            if file_path.endswith('.json'):
                return await self._parse_json(file_path)
            elif file_path.endswith('.xml'):
                return await self._parse_xml(file_path)
            elif file_path.endswith('.csv'):
                return await self._parse_csv(file_path)
            else:
                raise ValueError(f"Unsupported file format: {file_path}")
                
        except Exception as e:
            raise Exception(f"Failed to parse UFDR file: {str(e)}")
    
    async def _parse_json(self, file_path: str) -> ParsedData:
        """Parse JSON UFDR file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract device info
        self.device_info = data.get('device_info', {})
        
        # Parse messages
        messages_data = data.get('messages', [])
        for msg_data in messages_data:
            message = StandardizedMessage(
                source_device=msg_data.get('source_device', self.device_info.get('device_id', 'unknown')),
                app_name=msg_data.get('app_name', 'Unknown'),
                sender_id=msg_data.get('sender_id', ''),
                receiver_id=msg_data.get('receiver_id', ''),
                timestamp=self._parse_timestamp(msg_data.get('timestamp', '')),
                content=msg_data.get('content', ''),
                message_type=msg_data.get('message_type', 'text'),
                metadata=msg_data.get('metadata', {})
            )
            self.messages.append(message)
        
        # Parse calls
        calls_data = data.get('calls', [])
        for call_data in calls_data:
            call = StandardizedCall(
                source_device=call_data.get('source_device', self.device_info.get('device_id', 'unknown')),
                caller_id=call_data.get('caller_id', ''),
                receiver_id=call_data.get('receiver_id', ''),
                timestamp=self._parse_timestamp(call_data.get('timestamp', '')),
                duration=call_data.get('duration', 0),
                call_type=call_data.get('call_type', 'outgoing'),
                metadata=call_data.get('metadata', {})
            )
            self.calls.append(call)
        
        # Parse contacts
        contacts_data = data.get('contacts', [])
        for contact_data in contacts_data:
            contact = StandardizedContact(
                source_device=contact_data.get('source_device', self.device_info.get('device_id', 'unknown')),
                contact_id=contact_data.get('contact_id', ''),
                name=contact_data.get('name', ''),
                phone_numbers=contact_data.get('phone_numbers', []),
                email_addresses=contact_data.get('email_addresses', []),
                metadata=contact_data.get('metadata', {})
            )
            self.contacts.append(contact)
        
        return ParsedData(
            device_info=self.device_info,
            messages=self.messages,
            calls=self.calls,
            contacts=self.contacts,
            total_records=len(self.messages) + len(self.calls) + len(self.contacts),
            parsing_metadata={
                "parser_type": "ufdr_json",
                "file_path": file_path,
                "parsed_at": datetime.utcnow().isoformat()
            }
        )
    
    async def _parse_xml(self, file_path: str) -> ParsedData:
        """Parse XML UFDR file"""
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # Extract device info
        device_elem = root.find('device')
        if device_elem is not None:
            self.device_info = {attr: device_elem.get(attr, '') for attr in device_elem.attrib}
        
        # Parse messages
        for msg_elem in root.findall('.//message'):
            message = StandardizedMessage(
                source_device=msg_elem.get('source_device', self.device_info.get('device_id', 'unknown')),
                app_name=msg_elem.get('app_name', 'Unknown'),
                sender_id=msg_elem.get('sender_id', ''),
                receiver_id=msg_elem.get('receiver_id', ''),
                timestamp=self._parse_timestamp(msg_elem.get('timestamp', '')),
                content=msg_elem.get('content', msg_elem.text or ''),
                message_type=msg_elem.get('message_type', 'text'),
                metadata={attr: msg_elem.get(attr) for attr in msg_elem.attrib if attr not in ['sender_id', 'receiver_id', 'timestamp', 'content']}
            )
            self.messages.append(message)
        
        return ParsedData(
            device_info=self.device_info,
            messages=self.messages,
            calls=self.calls,
            contacts=self.contacts,
            total_records=len(self.messages) + len(self.calls) + len(self.contacts),
            parsing_metadata={
                "parser_type": "ufdr_xml",
                "file_path": file_path,
                "parsed_at": datetime.utcnow().isoformat()
            }
        )
    
    async def _parse_csv(self, file_path: str) -> ParsedData:
        """Parse CSV UFDR file"""
        df = pd.read_csv(file_path)
        
        # Assume CSV contains messages by default
        for _, row in df.iterrows():
            message = StandardizedMessage(
                source_device=row.get('source_device', 'unknown'),
                app_name=row.get('app_name', 'Unknown'),
                sender_id=str(row.get('sender_id', '')),
                receiver_id=str(row.get('receiver_id', '')),
                timestamp=self._parse_timestamp(str(row.get('timestamp', ''))),
                content=str(row.get('content', '')),
                message_type=row.get('message_type', 'text'),
                metadata={col: str(row[col]) for col in df.columns if col not in ['sender_id', 'receiver_id', 'timestamp', 'content', 'app_name', 'source_device', 'message_type']}
            )
            self.messages.append(message)
        
        return ParsedData(
            device_info={"source": "csv_import"},
            messages=self.messages,
            calls=self.calls,
            contacts=self.contacts,
            total_records=len(self.messages),
            parsing_metadata={
                "parser_type": "ufdr_csv",
                "file_path": file_path,
                "parsed_at": datetime.utcnow().isoformat()
            }
        )
    
    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """Parse timestamp string to datetime object"""
        if not timestamp_str or timestamp_str == 'nan':
            return datetime.utcnow()
        
        # Try different timestamp formats
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S.%f',
            '%d/%m/%Y %H:%M:%S',
            '%m/%d/%Y %H:%M:%S',
            '%Y-%m-%d',
            '%d/%m/%Y',
            '%m/%d/%Y'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        # Try Unix timestamp
        try:
            timestamp = float(timestamp_str)
            if timestamp > 1000000000000:  # Milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
        except:
            pass
        
        return datetime.utcnow()
