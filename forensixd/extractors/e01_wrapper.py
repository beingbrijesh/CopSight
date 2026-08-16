"""
forensixd.extractors.e01_wrapper
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Wrapper allowing pytsk3 to read EWF/E01 images via pyewf.
"""

from __future__ import annotations

import logging

try:
    import pytsk3  # type: ignore[import-untyped]
    import pyewf   # type: ignore[import-untyped]
    EWF_AVAILABLE = True
except ImportError:
    EWF_AVAILABLE = False

_logger = logging.getLogger(__name__)

if EWF_AVAILABLE:
    class EWFImgInfo(pytsk3.Img_Info):
        """Wrapper for pyewf.handle to provide a pytsk3.Img_Info compatible interface.
        
        This allows pytsk3 to read raw bytes from an Expert Witness Format (E01)
        image seamlessly.
        """

        def __init__(self, ewf_handle: 'pyewf.handle') -> None:
            """Initialize the wrapper with an open pyewf.handle."""
            self._ewf_handle = ewf_handle
            super().__init__(url="", type=pytsk3.TSK_IMG_TYPE_EXTERNAL)

        def close(self) -> None:
            self._ewf_handle.close()

        def read(self, offset: int, size: int) -> bytes:
            """Read *size* bytes from the image starting at *offset*."""
            self._ewf_handle.seek(offset)
            return self._ewf_handle.read(size)

        def get_size(self) -> int:
            """Return the total uncompressed size of the image in bytes."""
            return self._ewf_handle.get_media_size()
else:
    # Dummy class for when pyewf is not installed
    class EWFImgInfo:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            raise NotImplementedError("pyewf is not installed.")
