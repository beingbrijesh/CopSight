"""
forensixd.extractors
~~~~~~~~~~~~~~~~~~~~

Initialize the package and import all concrete extractor implementations
to ensure they are registered with the ExtractorRegistry via decorators.
"""

from forensixd.extractors import android, ios, windows, disk_image

__all__ = [
    "android",
    "ios",
    "windows",
    "disk_image",
]
