"""
Unified Media Storage Service (Hybrid Local + S3)
"""
import os
import aiofiles
import boto3
from botocore.exceptions import ClientError
from loguru import logger
from app.config import settings

class StorageService:
    def __init__(self):
        self.local_media_dir = "./media_storage"
        os.makedirs(self.local_media_dir, exist_ok=True)
        
        self.s3_client = None
        self.bucket_name = settings.AWS_S3_BUCKET
        
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and self.bucket_name:
            try:
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION
                )
                logger.info(f"S3 Storage initialized for bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {e}")

    async def save_media(self, case_id: int, file_name: str, file_data: bytes) -> str:
        """
        Saves media to local disk.
        If S3 is configured, also uploads asynchronously in the background.
        """
        case_dir = os.path.join(self.local_media_dir, str(case_id))
        os.makedirs(case_dir, exist_ok=True)
        
        local_file_path = os.path.join(case_dir, file_name)
        
        async with aiofiles.open(local_file_path, 'wb') as out_file:
            await out_file.write(file_data)
        
        logger.info(f"Saved media locally at {local_file_path}")
        
        # We can fire and forget the S3 upload
        if self.s3_client:
            self._upload_to_s3(local_file_path, f"cases/{case_id}/{file_name}")
            
        return local_file_path

    def _upload_to_s3(self, local_file_path: str, s3_key: str):
        """Synchronous S3 upload (can be run in threadpool or arq worker)"""
        try:
            if self.s3_client is not None:
                self.s3_client.upload_file(local_file_path, self.bucket_name, s3_key)
                logger.info(f"Successfully uploaded {local_file_path} to S3 bucket {self.bucket_name}")
            else:
                logger.warning("S3 client is None, skipping upload.")
        except ClientError as e:
            logger.error(f"Failed to upload {local_file_path} to S3: {e}")

storage_service = StorageService()
