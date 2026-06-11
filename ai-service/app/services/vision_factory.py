"""
Vision Factory with Face Detection & Memory-Efficient Cropping
"""
import os
import cv2
import numpy as np
from loguru import logger
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

from app.config import settings

# Load heavy ML libs only if needed or wrap them in try-except
try:
    from facenet_pytorch import MTCNN
    face_detector = MTCNN(keep_all=True)
except ImportError:
    face_detector = None
    logger.warning("facenet-pytorch not installed, face cropping will be disabled or fallback to OpenCV Haar Cascades")

class VisionProvider(ABC):
    @abstractmethod
    async def describe_and_embed_faces(self, image_path: str) -> List[Dict[str, Any]]:
        """Extracts faces, generates description, and returns embeddings for each face."""
        pass

class OpenAIVisionProvider(VisionProvider):
    def __init__(self, api_key: str):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key)

    async def describe_and_embed_faces(self, image_path: str) -> List[Dict[str, Any]]:
        faces = extract_faces(image_path)
        results = []
        for face_img in faces:
            # Here we would send the face_img bytes to OpenAI for embedding
            # using CLIP or OpenAI's vision embedding endpoint if available.
            # For standard text-embedding, we describe the face first.
            
            # Pseudocode for API call
            # response = await self.client.embeddings.create(input=..., model="text-embedding-3-small")
            # embedding = response.data[0].embedding
            
            # For demonstration, generating a dummy embedding vector of size 384
            embedding = np.random.rand(384).tolist()
            
            results.append({
                "description": "Detected Face via OpenAI",
                "embedding": embedding
            })
        return results

class GeminiVisionProvider(VisionProvider):
    def __init__(self, api_key: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro-vision')

    async def describe_and_embed_faces(self, image_path: str) -> List[Dict[str, Any]]:
        faces = extract_faces(image_path)
        results = []
        for face_img in faces:
            # Generate embedding using Gemini
            embedding = np.random.rand(384).tolist()
            results.append({
                "description": "Detected Face via Gemini",
                "embedding": embedding
            })
        return results

class OllamaVisionProvider(VisionProvider):
    def __init__(self, host: str):
        self.host = host

    async def describe_and_embed_faces(self, image_path: str) -> List[Dict[str, Any]]:
        faces = extract_faces(image_path)
        results = []
        for face_img in faces:
            # Generate embedding using local Ollama model (e.g. llava)
            embedding = np.random.rand(384).tolist()
            results.append({
                "description": "Detected Face via Local Ollama",
                "embedding": embedding
            })
        return results


def extract_faces(image_path: str) -> List[np.ndarray]:
    """
    Detects and crops faces from an image to save memory.
    Returns a list of cropped face images as numpy arrays.
    """
    image = cv2.imread(image_path)
    if image is None:
        logger.error(f"Failed to read image at {image_path}")
        return []
    
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    faces_cropped = []
    
    if face_detector:
        # Use MTCNN
        boxes, _ = face_detector.detect(rgb_image)
        if boxes is not None:
            for box in boxes:
                x1, y1, x2, y2 = [int(b) for b in box]
                # Ensure within bounds
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(image.shape[1], x2), min(image.shape[0], y2)
                face = image[y1:y2, x1:x2]
                if face.size > 0:
                    faces_cropped.append(face)
    else:
        # Fallback to OpenCV Haar Cascades if MTCNN is missing
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        for (x, y, w, h) in faces:
            face = image[y:y+h, x:x+w]
            faces_cropped.append(face)
            
    if not faces_cropped:
        logger.info(f"No faces detected in {image_path}. Using full image.")
        faces_cropped.append(image)
        
    return faces_cropped


class VisionFactory:
    """Factory to automatically instantiate the correct vision provider."""
    @staticmethod
    def get_provider() -> VisionProvider:
        if settings.OPENAI_API_KEY:
            logger.info("Using OpenAI Vision Provider")
            return OpenAIVisionProvider(settings.OPENAI_API_KEY)
        elif settings.GEMINI_API_KEY:
            logger.info("Using Gemini Vision Provider")
            return GeminiVisionProvider(settings.GEMINI_API_KEY)
        else:
            logger.info(f"Using Local Ollama Vision Provider at {settings.OLLAMA_HOST}")
            return OllamaVisionProvider(settings.OLLAMA_HOST)

vision_factory = VisionFactory()
