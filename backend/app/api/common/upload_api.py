from fastapi import APIRouter, UploadFile, File
from dependencies.auth import CurrentUser
from services.common.azure_blob_service import azure_blob_service

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/image", response_model=dict)
async def upload_image(
    current_user: CurrentUser,
    file: UploadFile = File(...)
):
    """Upload an image (max 2MB) to Azure Blob Storage."""
    image_url = await azure_blob_service.upload_image(file)
    return {"url": image_url}


@router.post("/video", response_model=dict)
async def upload_video(
    current_user: CurrentUser,
    file: UploadFile = File(...)
):
    """Upload a video (max 30MB) to Azure Blob Storage."""
    video_url = await azure_blob_service.upload_video(file)
    return {"url": video_url}


@router.post("/file", response_model=dict)
async def upload_file(
    current_user: CurrentUser,
    file: UploadFile = File(...)
):
    """Upload a document (pdf, docx, txt — max 10MB) to Azure Blob Storage."""
    file_url = await azure_blob_service.upload_document(file)
    return {"url": file_url}
