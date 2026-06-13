"""
Unified Media Storage Service (Cloudflare R2 primary, local fallback)
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
        self.bucket_name = None
        self.storage_type = "local"

        # Prefer Cloudflare R2 over AWS S3
        if (
            settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
            and settings.R2_ENDPOINT
            and settings.R2_BUCKET_NAME
        ):
            try:
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    endpoint_url=settings.R2_ENDPOINT,
                    region_name="auto",
                )
                self.bucket_name = settings.R2_BUCKET_NAME
                self.storage_type = "r2"
                logger.info(f"☁️  Cloudflare R2 Storage initialized (bucket: {self.bucket_name})")
            except Exception as e:
                logger.error(f"Failed to initialize R2 client: {e}")
        elif (
            settings.AWS_ACCESS_KEY_ID
            and settings.AWS_SECRET_ACCESS_KEY
            and settings.AWS_S3_BUCKET
        ):
            try:
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION,
                )
                self.bucket_name = settings.AWS_S3_BUCKET
                self.storage_type = "s3"
                logger.info(f"☁️  AWS S3 Storage initialized (bucket: {self.bucket_name})")
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {e}")

    async def save_media(self, case_id: int, file_name: str, file_data: bytes) -> str:
        """
        Saves media to cloud storage (R2/S3) if configured, else local disk.
        Returns the storage key or local file path.
        """
        s3_key = f"cases/{case_id}/media/{file_name}"

        if self.s3_client and self.bucket_name:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=file_data,
                )
                logger.info(f"Uploaded media to {self.storage_type}://{self.bucket_name}/{s3_key}")
                return s3_key
            except ClientError as e:
                logger.error(f"Cloud upload failed, falling back to local: {e}")

        # Fallback: save locally
        case_dir = os.path.join(self.local_media_dir, str(case_id))
        os.makedirs(case_dir, exist_ok=True)
        local_file_path = os.path.join(case_dir, file_name)

        async with aiofiles.open(local_file_path, "wb") as out_file:
            await out_file.write(file_data)

        logger.info(f"Saved media locally at {local_file_path}")
        return local_file_path

    def get_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str | None:
        """Generate a pre-signed URL for reading the object (1 hour default)."""
        if not self.s3_client or not self.bucket_name:
            return None
        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=expires_in,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None


storage_service = StorageService()
