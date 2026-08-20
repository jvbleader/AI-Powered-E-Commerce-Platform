import uuid
import mimetypes
from fastapi import UploadFile, HTTPException
from azure.storage.blob.aio import BlobServiceClient
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
try:
    from core.config import settings
except ImportError:
    from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_VIDEO_BYTES = 30 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024

ALLOWED_FILE_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
ALLOWED_FILE_EXTENSIONS = {".pdf", ".docx", ".txt"}


class AzureBlobService:
    def __init__(self):
        if not settings.AZURE_STORAGE_CONNECTION_STRING:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING is not set. Image uploads will fail.")
        else:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                settings.AZURE_STORAGE_CONNECTION_STRING
            )
            self.container_name = settings.AZURE_CONTAINER_NAME

    async def get_container_client(self):
        if not hasattr(self, 'blob_service_client'):
             raise HTTPException(status_code=500, detail="Azure Blob Storage is not configured.")
             
        container_client = self.blob_service_client.get_container_client(self.container_name)
        try:
            await container_client.get_container_properties()
        except ResourceNotFoundError:
            try:
                await container_client.create_container(public_access="blob")
            except ResourceExistsError:
                pass
        return container_client

    async def _upload_blob(
        self,
        file: UploadFile,
        *,
        allowed_prefix: str,
        max_bytes: int,
        folder: str,
    ) -> str:
        if not file.content_type or not file.content_type.startswith(allowed_prefix):
            raise HTTPException(
                status_code=400,
                detail=f"File must be a {allowed_prefix.rstrip('/')} file.",
            )

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File is empty.")
        if len(content) > max_bytes:
            max_mb = max_bytes / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds the {max_mb:g}MB limit.",
            )

        file_extension = mimetypes.guess_extension(file.content_type) or ""
        blob_name = f"{folder}/{uuid.uuid4()}{file_extension}"

        container_client = await self.get_container_client()
        blob_client = container_client.get_blob_client(blob_name)

        try:
            from azure.storage.blob import ContentSettings
            content_settings = ContentSettings(content_type=file.content_type)

            await blob_client.upload_blob(content, overwrite=True, content_settings=content_settings)
            return blob_client.url
        except Exception as e:
            logger.error(f"Failed to upload blob to Azure: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload file.")

    async def upload_image(self, file: UploadFile) -> str:
        """Uploads an image to Azure Blob Storage and returns the public URL."""
        return await self._upload_blob(
            file,
            allowed_prefix="image/",
            max_bytes=MAX_IMAGE_BYTES,
            folder="chat/images",
        )

    async def upload_video(self, file: UploadFile) -> str:
        """Uploads a video to Azure Blob Storage and returns the public URL."""
        return await self._upload_blob(
            file,
            allowed_prefix="video/",
            max_bytes=MAX_VIDEO_BYTES,
            folder="chat/videos",
        )

    async def upload_document(self, file: UploadFile) -> str:
        """Uploads a document (pdf, docx, txt) to Azure Blob Storage."""
        content_type = file.content_type or ""
        filename = (file.filename or "").lower()
        extension = ""
        for ext in ALLOWED_FILE_EXTENSIONS:
            if filename.endswith(ext):
                extension = ext
                break

        if content_type not in ALLOWED_FILE_CONTENT_TYPES and extension not in ALLOWED_FILE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="File must be PDF, DOCX, or TXT.",
            )

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File is empty.")
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")

        if not extension:
            extension = mimetypes.guess_extension(content_type) or ".bin"

        blob_name = f"chat/files/{uuid.uuid4()}{extension}"
        container_client = await self.get_container_client()
        blob_client = container_client.get_blob_client(blob_name)

        try:
            from azure.storage.blob import ContentSettings

            resolved_content_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
            content_settings = ContentSettings(content_type=resolved_content_type)
            await blob_client.upload_blob(content, overwrite=True, content_settings=content_settings)
            return blob_client.url
        except Exception as e:
            logger.error(f"Failed to upload document to Azure: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload file.")

    async def upload_bytes(
        self,
        content: bytes,
        blob_name: str,
        content_type: str = "application/pdf",
    ) -> str:
        """Uploads raw bytes to Azure Blob Storage and returns the public blob URL."""
        container_client = await self.get_container_client()
        blob_client = container_client.get_blob_client(blob_name)
        try:
            from azure.storage.blob import ContentSettings

            content_settings = ContentSettings(
                content_type=content_type,
                content_disposition="inline",
            )
            await blob_client.upload_blob(content, overwrite=True, content_settings=content_settings)
            return blob_client.url
        except Exception as e:
            logger.error(f"Failed to upload bytes to Azure: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload file to Azure.")

    async def delete_blob_by_url(self, blob_url: str) -> bool:
        """Deletes a blob by its public URL."""
        try:
            if not hasattr(self, "blob_service_client"):
                return False
            container_client = await self.get_container_client()
            if self.container_name in blob_url:
                blob_name = blob_url.split(f"{self.container_name}/")[-1]
                blob_client = container_client.get_blob_client(blob_name)
                await blob_client.delete_blob()
                return True
        except Exception as e:
            logger.warning(f"Failed to delete blob from Azure: {e}")
        return False


azure_blob_service = AzureBlobService()
