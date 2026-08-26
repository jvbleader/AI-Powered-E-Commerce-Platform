from __future__ import annotations

from fastapi import HTTPException, UploadFile, status

# 25 MB default limit for Knowledge Base PDFs
MAX_PDF_SIZE_BYTES: int = 25 * 1024 * 1024
DEFAULT_CHUNK_SIZE: int = 64 * 1024  # 64 KB per chunk
PDF_MAGIC_BYTES: bytes = b"%PDF-"


def validate_pdf_magic_bytes(content: bytes) -> bool:
    """Kiểm tra xem nội dung nhị phân có bắt đầu bằng header magic bytes của PDF (%PDF-) không."""
    if not content or len(content) < len(PDF_MAGIC_BYTES):
        return False
    return content.startswith(PDF_MAGIC_BYTES)


async def read_upload_file_bounded(
    file: UploadFile,
    max_bytes: int = MAX_PDF_SIZE_BYTES,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> bytes:
    """Đọc file từ UploadFile stream theo từng chunk và ngắt ngay khi vượt max_bytes.

    Ngăn chặn nguy cơ Out-Of-Memory (OOM) khi client gửi payload dung lượng lớn.
    
    Raises:
        HTTPException(400): Nếu file rỗng.
        HTTPException(413): Nếu kích thước file vượt quá max_bytes.
    """
    buffer = bytearray()
    total_read = 0

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break

        total_read += len(chunk)
        if total_read > max_bytes:
            max_mb = max_bytes / (1024 * 1024)
            raise HTTPException(
                status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
                detail=f"Dung lượng file vượt quá giới hạn cho phép ({max_mb:g}MB).",
            )
        buffer.extend(chunk)

    if total_read == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File PDF tải lên rỗng.",
        )

    return bytes(buffer)
