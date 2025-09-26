import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any
import re

from models import ParsedData, StandardizedMessage, StandardizedCall, StandardizedContact

class CellebriteParser:
    """Parser for Cellebrite UFDR XML files"""
    
    def __init__(self):
        self.device_info = {}
        self.messages = []
        self.calls = []
        self.contacts = []
    
    async def parse_file(self, file_path: str) -> ParsedData:
        """Parse Cellebrite XML file and return standardized data"""
        
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Extract device information
            self._extract_device_info(root)
            
            # Extract messages
            self._extract_messages(root)
            
            # Extract call logs
            self._extract_calls(root)
            
            # Extract contacts
            self._extract_contacts(root)
            
            return ParsedData(
                device_info=self.device_info,
                messages=self.messages,
                calls=self.calls,
                contacts=self.contacts,
                total_records=len(self.messages) + len(self.calls) + len(self.contacts),
                parsing_metadata={
                    "parser_type": "cellebrite",
                    "file_path": file_path,
                    "parsed_at": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            raise Exception(f"Failed to parse Cellebrite file: {str(e)}")
    
    def _extract_device_info(self, root: ET.Element):
        """Extract device information from XML"""
        device_elem = root.find('.//device')
        if device_elem is not None:
            self.device_info = {
                "device_id": device_elem.get('id', ''),
                "device_name": device_elem.get('name', ''),
                "imei": device_elem.get('imei', ''),
                "phone_number": device_elem.get('phoneNumber', ''),
                "model": device_elem.get('model', ''),
                "manufacturer": device_elem.get('manufacturer', ''),
                "os_version": device_elem.get('osVersion', ''),
                "extraction_date": device_elem.get('extractionDate', '')
            }
    
    def _extract_messages(self, root: ET.Element):
        """Extract messages from XML"""
        # Look for different message types (SMS, WhatsApp, Telegram, etc.)
        message_elements = root.findall('.//message') + root.findall('.//sms') + root.findall('.//chat')
        
        for msg_elem in message_elements:
            try:
                # Extract basic message info
                sender = msg_elem.get('from', msg_elem.get('sender', ''))
                receiver = msg_elem.get('to', msg_elem.get('receiver', ''))
                timestamp_str = msg_elem.get('timestamp', msg_elem.get('time', ''))
                content = msg_elem.get('body', msg_elem.get('text', ''))
                
                # Try to get content from child elements if not in attributes
                if not content:
                    body_elem = msg_elem.find('body') or msg_elem.find('text')
                    if body_elem is not None:
                        content = body_elem.text or ''
                
                # Parse timestamp
                timestamp = self._parse_timestamp(timestamp_str)
                
                # Determine app name
                app_name = msg_elem.get('app', msg_elem.get('source', 'SMS'))
                
                # Determine message type
                msg_type = msg_elem.get('type', 'text')
                if msg_elem.find('attachment') is not None:
                    msg_type = 'file'
                
                message = StandardizedMessage(
                    source_device=self.device_info.get('device_id', 'unknown'),
                    app_name=app_name,
                    sender_id=sender,
                    receiver_id=receiver,
                    timestamp=timestamp,
                    content=content,
                    message_type=msg_type,
                    metadata={
                        "original_id": msg_elem.get('id', ''),
                        "thread_id": msg_elem.get('threadId', ''),
                        "status": msg_elem.get('status', ''),
                        "direction": msg_elem.get('direction', '')
                    }
                )
                
                self.messages.append(message)
                
            except Exception as e:
                print(f"Error parsing message: {e}")
                continue
    
    def _extract_calls(self, root: ET.Element):
        """Extract call logs from XML"""
        call_elements = root.findall('.//call') + root.findall('.//callLog')
        
        for call_elem in call_elements:
            try:
                caller = call_elem.get('from', call_elem.get('caller', ''))
                receiver = call_elem.get('to', call_elem.get('receiver', ''))
                timestamp_str = call_elem.get('timestamp', call_elem.get('time', ''))
                duration_str = call_elem.get('duration', '0')
                call_type = call_elem.get('type', call_elem.get('direction', 'outgoing'))
                
                # Parse timestamp and duration
                timestamp = self._parse_timestamp(timestamp_str)
                duration = self._parse_duration(duration_str)
                
                call = StandardizedCall(
                    source_device=self.device_info.get('device_id', 'unknown'),
                    caller_id=caller,
                    receiver_id=receiver,
                    timestamp=timestamp,
                    duration=duration,
                    call_type=call_type,
                    metadata={
                        "original_id": call_elem.get('id', ''),
                        "status": call_elem.get('status', ''),
                        "location": call_elem.get('location', '')
                    }
                )
                
                self.calls.append(call)
                
            except Exception as e:
                print(f"Error parsing call: {e}")
                continue
    
    def _extract_contacts(self, root: ET.Element):
        """Extract contacts from XML"""
        contact_elements = root.findall('.//contact') + root.findall('.//addressBook')
        
        for contact_elem in contact_elements:
            try:
                contact_id = contact_elem.get('id', '')
                name = contact_elem.get('name', contact_elem.get('displayName', ''))
                
                # Extract phone numbers
                phone_numbers = []
                phone_elems = contact_elem.findall('.//phone') + contact_elem.findall('.//phoneNumber')
                for phone_elem in phone_elems:
                    phone = phone_elem.get('number', phone_elem.text or '')
                    if phone:
                        phone_numbers.append(phone)
                
                # Extract email addresses
                email_addresses = []
                email_elems = contact_elem.findall('.//email')
                for email_elem in email_elems:
                    email = email_elem.get('address', email_elem.text or '')
                    if email:
                        email_addresses.append(email)
                
                contact = StandardizedContact(
                    source_device=self.device_info.get('device_id', 'unknown'),
                    contact_id=contact_id,
                    name=name,
                    phone_numbers=phone_numbers,
                    email_addresses=email_addresses,
                    metadata={
                        "organization": contact_elem.get('organization', ''),
                        "photo": contact_elem.get('photo', ''),
                        "last_contacted": contact_elem.get('lastContacted', '')
                    }
                )
                
                self.contacts.append(contact)
                
            except Exception as e:
                print(f"Error parsing contact: {e}")
                continue
    
    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """Parse timestamp string to datetime object"""
        if not timestamp_str:
            return datetime.utcnow()
        
        # Try different timestamp formats
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S.%f',
            '%d/%m/%Y %H:%M:%S',
            '%m/%d/%Y %H:%M:%S'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        # If all formats fail, try to extract timestamp from Unix timestamp
        try:
            # Check if it's a Unix timestamp (in milliseconds)
            if timestamp_str.isdigit():
                timestamp = int(timestamp_str)
                if timestamp > 1000000000000:  # Milliseconds
                    timestamp = timestamp / 1000
                return datetime.fromtimestamp(timestamp)
        except:
            pass
        
        # Return current time if parsing fails
        return datetime.utcnow()
    
    def _parse_duration(self, duration_str: str) -> int:
        """Parse duration string to seconds"""
        if not duration_str:
            return 0
        
        try:
            # If it's just a number, assume it's seconds
            if duration_str.isdigit():
                return int(duration_str)
            
            # Parse HH:MM:SS format
            if ':' in duration_str:
                parts = duration_str.split(':')
                if len(parts) == 3:
                    hours, minutes, seconds = map(int, parts)
                    return hours * 3600 + minutes * 60 + seconds
                elif len(parts) == 2:
                    minutes, seconds = map(int, parts)
                    return minutes * 60 + seconds
            
            return 0
        except:
            return 0
