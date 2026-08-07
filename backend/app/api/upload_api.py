from fastapi import APIRouter, Depends, UploadFile, File
from dependencies.auth import CurrentUser
from services.azure_blob_service import azure_blob_service

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("/image", response_model=dict)
async def upload_image(
    current_user: CurrentUser,
    file: UploadFile = File(...)
):
    """
    Upload an image to Azure Blob Storage.
    Only authenticated users can upload.
    """
    image_url = await azure_blob_service.upload_image(file)
    return {"url": image_url}
