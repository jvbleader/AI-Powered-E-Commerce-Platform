import uuid
import mimetypes
from fastapi import UploadFile, HTTPException
from azure.storage.blob.aio import BlobServiceClient
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

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
                # Try to create if it doesn't exist (with blob public access)
                await container_client.create_container(public_access="blob")
            except ResourceExistsError:
                pass
        return container_client

    async def upload_image(self, file: UploadFile) -> str:
        """
        Uploads an image to Azure Blob Storage and returns the public URL.
        """
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image.")

        # Generate a unique filename
        file_extension = mimetypes.guess_extension(file.content_type) or ".jpg"
        blob_name = f"{uuid.uuid4()}{file_extension}"
        
        container_client = await self.get_container_client()
        blob_client = container_client.get_blob_client(blob_name)
        
        try:
            # Upload the file
            content = await file.read()
            # Set content_settings so browser displays instead of downloads
            from azure.storage.blob import ContentSettings
            content_settings = ContentSettings(content_type=file.content_type)
            
            await blob_client.upload_blob(content, overwrite=True, content_settings=content_settings)
            
            # Construct the public URL
            blob_url = blob_client.url
            return blob_url
        except Exception as e:
            logger.error(f"Failed to upload image to Azure: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload image.")

azure_blob_service = AzureBlobService()
