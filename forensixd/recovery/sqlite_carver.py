"""
forensixd.recovery.sqlite_carver
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Carves deleted records and orphaned data from SQLite database files,
freelist trunk/leaf pages, unallocated page slack, and WAL/journal logs.

Recovers deleted WhatsApp/Signal/Telegram messages, SMS, Call Logs, and
Contacts into clean, readable CSV and JSON files.
"""

from __future__ import annotations

import csv
import json
import logging
import re
import struct
from pathlib import Path
from typing import Any, Iterator, NamedTuple, Optional

_logger = logging.getLogger(__name__)

__all__ = ["RecoveredRecord", "SQLiteFreelistCarver"]


class RecoveredRecord(NamedTuple):
    """A single recovered record from SQLite unallocated space or freelist."""
    record_type: str  # 'message', 'call_log', 'contact', 'generic'
    source_db: str
    offset: int
    fields: dict[str, Any]
    raw_text: str


class SQLiteFreelistCarver:
    """Scans SQLite database files, freelists, unallocated spaces, and WAL files to carve deleted rows."""

    SQLITE_HEADER = b"SQLite format 3\x00"

    def __init__(self) -> None:
        pass

    def carve_database(self, db_path: Path | str, output_dir: Path) -> list[RecoveredRecord]:
        """Carve deleted records from an SQLite database and its companion WAL/journal files."""
        db_p = Path(db_path)
        if not db_p.exists() or not db_p.is_file():
            return []

        output_dir.mkdir(parents=True, exist_ok=True)
        raw_data = db_p.read_bytes()
        if not raw_data.startswith(self.SQLITE_HEADER):
            return []

        records = list(self._carve_db_bytes(raw_data, db_p.name))

        # Check for associated WAL file
        wal_path = db_p.with_name(db_p.name + "-wal")
        if wal_path.exists():
            wal_data = wal_path.read_bytes()
            records.extend(self._carve_wal_bytes(wal_data, wal_path.name))

        # Check for associated Journal file
        journal_path = db_p.with_name(db_p.name + "-journal")
        if journal_path.exists():
            journal_data = journal_path.read_bytes()
            records.extend(self._carve_raw_strings(journal_data, journal_path.name))

        # Export structured reports
        self._export_records(records, output_dir, db_p.stem)
        return records

    def carve_all_databases_in_dir(self, root_dir: Path | str, output_dir: Path) -> list[RecoveredRecord]:
        """Recursively scan directory for SQLite databases and carve deleted records."""
        root_p = Path(root_dir)
        all_records = []
        if not root_p.exists():
            return []

        for candidate in root_p.rglob("*"):
            if candidate.is_file() and candidate.stat().st_size >= 512:
                try:
                    header = candidate.open("rb").read(16)
                    if header == self.SQLITE_HEADER:
                        recs = self.carve_database(candidate, output_dir / candidate.stem)
                        all_records.extend(recs)
                except Exception as e:
                    _logger.debug("Failed scanning candidate db %s: %s", candidate, e)

        if all_records:
            # Export consolidated reports across all scanned DBs
            self._export_records(all_records, output_dir, "all_databases_recovered")
        return all_records

    # ------------------------------------------------------------------
    # Private Parsing Engine
    # ------------------------------------------------------------------

    def _carve_db_bytes(self, data: bytes, db_name: str) -> Iterator[RecoveredRecord]:
        """Parse SQLite pages, freelists, and unallocated gaps."""
        if len(data) < 100 or not data.startswith(self.SQLITE_HEADER):
            return

        # Read page size (offset 16-17)
        page_size_val = struct.unpack(">H", data[16:18])[0]
        page_size = 65536 if page_size_val == 1 else page_size_val
        if page_size < 512 or page_size > 65536:
            page_size = 4096

        total_pages = len(data) // page_size
        
        # 1. Parse Freelist Trunk and Leaf Pages
        first_trunk_page = struct.unpack(">I", data[32:36])[0]
        total_freelist_pages = struct.unpack(">I", data[36:40])[0]

        if first_trunk_page > 0 and total_freelist_pages > 0:
            yield from self._parse_freelist_chain(data, first_trunk_page, page_size, db_name)

        # 2. Parse Unallocated Page Gaps, Freeblocks, and Cell Slack on each B-Tree Page
        seen_offsets = set()
        for page_num in range(1, total_pages + 1):
            page_offset = (page_num - 1) * page_size
            page_data = data[page_offset : page_offset + page_size]
            yield from self._parse_btree_page_slack(page_data, page_offset, page_num, db_name)
            # Scan raw page chunks for orphaned text records
            for r in self._carve_raw_strings(page_data, db_name, page_offset):
                if (r.offset, r.raw_text) not in seen_offsets:
                    seen_offsets.add((r.offset, r.raw_text))
                    yield r

    def _parse_freelist_chain(
        self, data: bytes, first_trunk: int, page_size: int, db_name: str
    ) -> Iterator[RecoveredRecord]:
        """Follow freelist trunk pages and carve records from freelist leaf pages."""
        curr_trunk = first_trunk
        visited = set()

        while curr_trunk > 0 and curr_trunk not in visited:
            visited.add(curr_trunk)
            trunk_offset = (curr_trunk - 1) * page_size
            if trunk_offset + page_size > len(data):
                break

            trunk_data = data[trunk_offset : trunk_offset + page_size]
            next_trunk = struct.unpack(">I", trunk_data[0:4])[0]
            leaf_count = struct.unpack(">I", trunk_data[4:8])[0]

            for i in range(leaf_count):
                leaf_ptr_offset = 8 + i * 4
                if leaf_ptr_offset + 4 > len(trunk_data):
                    break
                leaf_page_num = struct.unpack(">I", trunk_data[leaf_ptr_offset : leaf_ptr_offset + 4])[0]
                if leaf_page_num > 0:
                    leaf_offset = (leaf_page_num - 1) * page_size
                    if leaf_offset + page_size <= len(data):
                        leaf_bytes = data[leaf_offset : leaf_offset + page_size]
                        yield from self._carve_raw_strings(leaf_bytes, db_name, leaf_offset, is_freelist=True)

            curr_trunk = next_trunk

    def _parse_btree_page_slack(
        self, page_data: bytes, page_offset: int, page_num: int, db_name: str
    ) -> Iterator[RecoveredRecord]:
        """Extract unallocated gaps between cells and freeblock chains on a B-tree page."""
        hdr_offset = 100 if page_num == 1 else 0
        if len(page_data) < hdr_offset + 8:
            return

        page_type = page_data[hdr_offset]
        # 0x0D = Table Leaf, 0x05 = Table Interior, 0x0A = Index Leaf, 0x02 = Index Interior
        if page_type not in (0x0D, 0x05, 0x0A, 0x02):
            return

        first_freeblock = struct.unpack(">H", page_data[hdr_offset+1 : hdr_offset+3])[0]
        cell_count = struct.unpack(">H", page_data[hdr_offset+3 : hdr_offset+5])[0]
        cell_content_offset = struct.unpack(">H", page_data[hdr_offset+5 : hdr_offset+7])[0]
        if cell_content_offset == 0:
            cell_content_offset = len(page_data)

        cell_ptr_array_end = hdr_offset + (8 if page_type in (0x0D, 0x0A) else 12) + (cell_count * 2)

        # Unallocated space between cell pointer array and cell content start
        if cell_content_offset > cell_ptr_array_end:
            unalloc_slack = page_data[cell_ptr_array_end : cell_content_offset]
            if len(unalloc_slack) >= 16:
                yield from self._carve_raw_strings(unalloc_slack, db_name, page_offset + cell_ptr_array_end, is_slack=True)

        # Follow freeblock chain
        curr_fb = first_freeblock
        fb_visited = set()
        while curr_fb > 0 and curr_fb < len(page_data) and curr_fb not in fb_visited:
            fb_visited.add(curr_fb)
            if curr_fb + 4 > len(page_data):
                break
            next_fb = struct.unpack(">H", page_data[curr_fb : curr_fb+2])[0]
            fb_size = struct.unpack(">H", page_data[curr_fb+2 : curr_fb+4])[0]
            if fb_size > 4 and curr_fb + fb_size <= len(page_data):
                fb_data = page_data[curr_fb+4 : curr_fb+fb_size]
                yield from self._carve_raw_strings(fb_data, db_name, page_offset + curr_fb + 4, is_slack=True)
            curr_fb = next_fb

    def _carve_wal_bytes(self, wal_data: bytes, wal_name: str) -> Iterator[RecoveredRecord]:
        """Carve frames from Write-Ahead Log (.wal) files."""
        if len(wal_data) < 32:
            return
        
        # Check WAL magic: 0x377f0682 or 0x377f0683
        magic = struct.unpack(">I", wal_data[0:4])[0]
        if magic not in (0x377F0682, 0x377F0683):
            yield from self._carve_raw_strings(wal_data, wal_name)
            return

        page_size = struct.unpack(">I", wal_data[8:12])[0]
        if page_size < 512 or page_size > 65536:
            page_size = 4096

        frame_size = 24 + page_size
        offset = 32
        while offset + frame_size <= len(wal_data):
            frame_page_data = wal_data[offset + 24 : offset + frame_size]
            yield from self._carve_raw_strings(frame_page_data, wal_name, offset + 24)
            offset += frame_size

    def _carve_raw_strings(
        self, data: bytes, source_name: str, base_offset: int = 0, is_freelist: bool = False, is_slack: bool = False
    ) -> Iterator[RecoveredRecord]:
        """Extract structured string tokens, chat records, call logs, and contacts from byte chunks."""
        # Find ASCII / UTF-8 text sequences of length >= 4
        text_chunks = re.findall(rb"[\x20-\x7E\t\r\n]{4,}", data)
        for chunk in text_chunks:
            try:
                decoded = chunk.decode("utf-8", errors="replace").strip()
                if not decoded or len(decoded) < 4:
                    continue

                # Filter out pure binary/hex noise
                if re.match(r"^[0-9a-fA-F]{32,}$", decoded):
                    continue

                record = self._classify_and_build_record(decoded, source_name, base_offset, is_freelist, is_slack)
                if record:
                    yield record
            except Exception:
                continue

    def _classify_and_build_record(
        self, text: str, source_name: str, offset: int, is_freelist: bool, is_slack: bool
    ) -> Optional[RecoveredRecord]:
        """Classify raw extracted text into Message, Call Log, Contact, or Generic record."""
        # Check for phone number pattern: +[0-9]{10,13} or standard 10 digits
        phone_match = re.search(r"(\+?[0-9]{10,14})", text)
        phone = phone_match.group(1) if phone_match else None

        # Check for WhatsApp JID: e.g. 919876543210@s.whatsapp.net
        wa_match = re.search(r"([0-9]{8,15})@(s\.whatsapp\.net|g\.us)", text)
        
        # Check for Email pattern
        email_match = re.search(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", text)
        email = email_match.group(1) if email_match else None

        # Check for Epoch Timestamp pattern (seconds or ms: 1600000000 to 1900000000)
        time_match = re.search(r"\b(1[5-9][0-9]{8}|1[5-9][0-9]{11})\b", text)
        timestamp = time_match.group(1) if time_match else None

        recovery_tag = "freelist" if is_freelist else ("slack" if is_slack else "unallocated")

        if wa_match or ("msgstore" in source_name.lower() and len(text) > 5):
            return RecoveredRecord(
                record_type="message",
                source_db=source_name,
                offset=offset,
                fields={
                    "sender_or_chat": wa_match.group(0) if wa_match else phone or "Unknown",
                    "body": text,
                    "timestamp": timestamp,
                    "recovery_source": recovery_tag,
                },
                raw_text=text,
            )
        elif phone and ("call" in source_name.lower() or "call_log" in source_name.lower()):
            return RecoveredRecord(
                record_type="call_log",
                source_db=source_name,
                offset=offset,
                fields={
                    "number": phone,
                    "timestamp": timestamp,
                    "details": text,
                    "recovery_source": recovery_tag,
                },
                raw_text=text,
            )
        elif (phone or email) and ("contact" in source_name.lower() or "phone" in source_name.lower()):
            return RecoveredRecord(
                record_type="contact",
                source_db=source_name,
                offset=offset,
                fields={
                    "phone": phone or "",
                    "email": email or "",
                    "raw_entry": text,
                    "recovery_source": recovery_tag,
                },
                raw_text=text,
            )
        elif len(text) >= 10:
            return RecoveredRecord(
                record_type="generic",
                source_db=source_name,
                offset=offset,
                fields={
                    "content": text,
                    "phone": phone or "",
                    "email": email or "",
                    "timestamp": timestamp or "",
                    "recovery_source": recovery_tag,
                },
                raw_text=text,
            )

        return None

    # ------------------------------------------------------------------
    # Reports Export
    # ------------------------------------------------------------------

    def _export_records(self, records: list[RecoveredRecord], output_dir: Path, base_name: str) -> None:
        """Export carved records into structured CSV and JSON files."""
        if not records:
            return

        messages = [r for r in records if r.record_type == "message"]
        calls = [r for r in records if r.record_type == "call_log"]
        contacts = [r for r in records if r.record_type == "contact"]
        generics = [r for r in records if r.record_type == "generic"]

        # 1. Recovered Messages CSV
        if messages:
            msg_csv = output_dir / f"{base_name}_recovered_messages.csv"
            with open(msg_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Source Database", "Offset", "Sender / Chat JID", "Timestamp", "Message Content", "Recovery Type"])
                for m in messages:
                    writer.writerow([m.source_db, m.offset, m.fields.get("sender_or_chat", ""), m.fields.get("timestamp", ""), m.fields.get("body", ""), m.fields.get("recovery_source", "")])

        # 2. Recovered Calls CSV
        if calls:
            calls_csv = output_dir / f"{base_name}_recovered_calls.csv"
            with open(calls_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Source Database", "Offset", "Phone Number", "Timestamp", "Details", "Recovery Type"])
                for c in calls:
                    writer.writerow([c.source_db, c.offset, c.fields.get("number", ""), c.fields.get("timestamp", ""), c.fields.get("details", ""), c.fields.get("recovery_source", "")])

        # 3. Recovered Contacts CSV
        if contacts:
            contacts_csv = output_dir / f"{base_name}_recovered_contacts.csv"
            with open(contacts_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Source Database", "Offset", "Phone Number", "Email", "Raw Entry", "Recovery Type"])
                for c in contacts:
                    writer.writerow([c.source_db, c.offset, c.fields.get("phone", ""), c.fields.get("email", ""), c.fields.get("raw_entry", ""), c.fields.get("recovery_source", "")])

        # 4. Master JSON export
        json_out = output_dir / f"{base_name}_recovered_records.json"
        with open(json_out, "w", encoding="utf-8") as f:
            json.dump([{"type": r.record_type, "db": r.source_db, "offset": r.offset, "fields": r.fields, "raw": r.raw_text} for r in records], f, indent=2)
