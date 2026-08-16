"""
tests.test_recovery.test_recovery
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Comprehensive tests for forensic file carving and SQLite deleted record recovery.
"""

import io
import struct
import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory

from forensixd.recovery.file_carver import FileSignatureCarver, CarvedFile
from forensixd.recovery.sqlite_carver import SQLiteFreelistCarver, RecoveredRecord
from forensixd.recovery.thumbnail_carver import ThumbnailCacheCarver


def test_carve_jpeg(tmp_path: Path):
    """Test carving valid JPEG image from binary stream."""
    carver = FileSignatureCarver()
    # Synthesize JPEG
    jpeg_payload = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\xaa" * 200 + b"\xff\xd9"
    junk = b"\x00" * 50 + jpeg_payload + b"\x11" * 50
    
    results = carver.carve_file_or_stream(junk, tmp_path, "test_jpg")
    assert len(results) == 1
    carved = results[0]
    assert carved.extension == ".jpg"
    assert carved.output_path.exists()
    assert carved.output_path.read_bytes() == jpeg_payload


def test_carve_png(tmp_path: Path):
    """Test carving valid PNG image from binary stream."""
    carver = FileSignatureCarver()
    # Synthesize PNG
    png_payload = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4" + b"\x00\x00\x00\x00IEND\xaeB`\x82"
    junk = b"RANDOM_DATA" + png_payload + b"TRAILING"

    results = carver.carve_file_or_stream(junk, tmp_path, "test_png")
    assert len(results) == 1
    assert results[0].extension == ".png"
    assert results[0].output_path.read_bytes() == png_payload


def test_carve_mp4_video(tmp_path: Path):
    """Test carving structurally valid MP4 video container with atoms."""
    carver = FileSignatureCarver()
    
    # Synthesize valid MP4 with ftyp, moov, and mdat atoms
    ftyp_data = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
    moov_data = b"\x00\x00\x01\x00moov" + b"\x00" * (256 - 8)
    mdat_data = b"\x00\x00\x02\x00mdat" + b"\x55" * (512 - 8)
    
    mp4_payload = ftyp_data + moov_data + mdat_data
    stream = b"\x00" * 128 + mp4_payload + b"\x00" * 64

    results = carver.carve_file_or_stream(stream, tmp_path, "test_mp4")
    assert len(results) == 1
    carved = results[0]
    assert carved.extension == ".mp4"
    assert carved.size == len(mp4_payload)
    assert carved.output_path.read_bytes() == mp4_payload


def test_carve_pdf(tmp_path: Path):
    """Test carving PDF document ending with %%EOF."""
    carver = FileSignatureCarver()
    pdf_payload = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 2\ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n50\n%%EOF\n"
    stream = b"NOISE" * 20 + pdf_payload + b"MORE_NOISE"

    results = carver.carve_file_or_stream(stream, tmp_path, "test_pdf")
    assert len(results) == 1
    assert results[0].extension == ".pdf"
    assert b"%PDF-" in results[0].output_path.read_bytes()
    assert b"%%EOF" in results[0].output_path.read_bytes()


def test_carve_sqlite_freelist_and_messages(tmp_path: Path):
    """Test carving deleted chat messages and SMS from SQLite database."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    db_file = tmp_path / "msgstore.db"
    
    # Create real SQLite database and insert dummy WhatsApp messages
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY, jid TEXT, body TEXT, timestamp INTEGER)")
    cursor.execute("INSERT INTO messages VALUES (1, '919876543210@s.whatsapp.net', 'Secret meeting at 10 PM tonight', 1690000000)")
    cursor.execute("INSERT INTO messages VALUES (2, '919123456789@s.whatsapp.net', 'Evidence file stored in downloads', 1690000500)")
    conn.commit()
    
    # Now delete records so they move into freelist / unallocated space
    cursor.execute("DELETE FROM messages WHERE id = 1")
    conn.commit()
    conn.close()

    carver = SQLiteFreelistCarver()
    output_dir = tmp_path / "carved_db_out"
    recovered = carver.carve_database(db_file, output_dir)

    assert len(recovered) > 0
    # Check that CSV and JSON export files were created
    csv_files = list(output_dir.glob("*.csv"))
    json_files = list(output_dir.glob("*.json"))
    assert len(csv_files) > 0
    assert len(json_files) > 0

    # Verify that the message text was recovered
    found_secret = any("Secret meeting" in r.raw_text or "919876543210" in r.raw_text for r in recovered)
    assert found_secret, "Failed to recover deleted chat text from SQLite DB"


def test_carve_thumbnail_cache(tmp_path: Path):
    """Test carving thumbnail previews from thumbdata cache file."""
    thumb_dir = tmp_path / "thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_file = thumb_dir / "thumbdata4--12345678"

    # Embedded JPEG inside thumbdata blob
    jpeg1 = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x12" * 150 + b"\xff\xd9"
    jpeg2 = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x34" * 180 + b"\xff\xd9"
    
    blob_data = b"HEADER_BLOB" * 10 + jpeg1 + b"INDEX_DATA" * 5 + jpeg2 + b"FOOTER"
    thumb_file.write_bytes(blob_data)

    carver = ThumbnailCacheCarver()
    out_dir = tmp_path / "thumb_out"
    results = carver.carve_thumbnail_directory(thumb_dir, out_dir)

    assert len(results) == 2
    for r in results:
        assert r.extension == ".jpg"
        assert r.output_path.exists()
