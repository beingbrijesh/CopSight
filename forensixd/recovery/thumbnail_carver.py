"""
forensixd.recovery.thumbnail_carver
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Extracts and reconstructs deleted/cached photos and previews from
Android .thumbnails/ directories, thumbdata3/4 index blobs, and app cache files.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import NamedTuple

from forensixd.recovery.file_carver import FileSignatureCarver, CarvedFile

_logger = logging.getLogger(__name__)

__all__ = ["ThumbnailCacheCarver"]


class ThumbnailCacheCarver:
    """Scans and extracts photo previews and original images from thumbnail cache files."""

    def __init__(self) -> None:
        self.file_carver = FileSignatureCarver()

    def carve_thumbnail_directory(self, thumb_dir: Path | str, output_dir: Path) -> list[CarvedFile]:
        """Scan .thumbnails/ and cache folders to extract all embedded image previews."""
        src = Path(thumb_dir)
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        if not src.exists():
            return []

        carved_results: list[CarvedFile] = []

        if src.is_file():
            carved_results.extend(self.file_carver.carve_file_or_stream(src, out_dir, f"thumb_{src.stem}"))
        else:
            for child in src.rglob("*"):
                if child.is_file() and child.stat().st_size > 128:
                    try:
                        # Extract directly from thumbdata blobs and image cache files
                        results = self.file_carver.carve_file_or_stream(child, out_dir, f"thumb_{child.stem}")
                        carved_results.extend(results)
                    except Exception as e:
                        _logger.debug("Error processing thumbnail cache file %s: %s", child, e)

        return carved_results
