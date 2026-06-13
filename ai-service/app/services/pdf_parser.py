"""
PDF Parsing service using PyMuPDF (fitz)
"""
import fitz
import os
from loguru import logger
from typing import Dict, Any

class PDFParser:
    """Parser for forensic PDF reports and extracted documents"""
    
    def __init__(self):
        pass

    async def parse(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a PDF file, extracting text and metadata using PyMuPDF.
        """
        logger.info(f"Parsing PDF file: {file_path}")
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"PDF not found: {file_path}")
                
            doc = fitz.open(file_path)
            content = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                if text.strip():
                    content.append(text.strip())
                    
            metadata = doc.metadata
            doc.close()
            
            full_text = "\n\n".join(content)
            
            return {
                "content": full_text,
                "metadata": {
                    "title": metadata.get("title", ""),
                    "author": metadata.get("author", ""),
                    "subject": metadata.get("subject", ""),
                    "creator": metadata.get("creator", ""),
                    "page_count": len(doc),
                    "file_name": os.path.basename(file_path)
                },
                "status": "success"
            }
        except Exception as e:
            logger.error(f"Error parsing PDF {file_path}: {e}")
            return {
                "content": "",
                "metadata": {"file_name": os.path.basename(file_path)},
                "status": "error",
                "error": str(e)
            }

pdf_parser = PDFParser()
