from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Any, BinaryIO, Dict, List
import pypdf


def _split_text_with_overlap(
    text: str,
    chunk_size: int = 600,
    chunk_overlap: int = 100,
) -> List[str]:
    """Split text into chunks of at most `chunk_size` characters with sliding window overlap.

    Intelligently breaks chunks at paragraph boundaries (\\n\\n), line breaks (\\n),
    sentence endings (. / ! / ?), or spaces to avoid cutting mid-word where possible.
    """
    text = (text or "").strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunk_size = max(1, chunk_size)
    if chunk_overlap < 0:
        chunk_overlap = 0
    elif chunk_overlap >= chunk_size:
        chunk_overlap = max(0, chunk_size // 2)

    chunks: List[str] = []
    start = 0
    text_len = len(text)

    while start < text_len:
        if text_len - start <= chunk_size:
            chunk = text[start:].strip()
            if chunk and (not chunks or chunk != chunks[-1]):
                chunks.append(chunk)
            break

        end = start + chunk_size
        target_sub = text[start:end]

        min_split = max(1, chunk_size // 3)
        split_pos = -1

        # Priority 1: Paragraph break
        r_dnl = target_sub.rfind("\n\n")
        if r_dnl >= min_split:
            split_pos = r_dnl + 2
        else:
            # Priority 2: Single newline
            r_nl = target_sub.rfind("\n")
            if r_nl >= min_split:
                split_pos = r_nl + 1
            else:
                # Priority 3: Sentence ending punctuation
                sentence_matches = list(re.finditer(r"([.!?])(?:\s+|$)", target_sub))
                if sentence_matches and sentence_matches[-1].end() >= min_split:
                    split_pos = sentence_matches[-1].end()
                else:
                    # Priority 4: Whitespace
                    r_space = target_sub.rfind(" ")
                    if r_space >= min_split:
                        split_pos = r_space + 1

        if split_pos <= 0:
            split_pos = chunk_size

        chunk = text[start : start + split_pos].strip()
        if chunk:
            chunks.append(chunk)

        actual_end = start + split_pos
        next_start = actual_end - chunk_overlap

        if next_start <= start:
            next_start = actual_end
        else:
            if next_start < text_len and text[next_start - 1] not in " \n\r\t" and text[next_start] not in " \n\r\t":
                prev_space = text.rfind(" ", start, next_start)
                if prev_space > start and (next_start - prev_space) <= 20:
                    next_start = prev_space + 1
                else:
                    next_space = text.find(" ", next_start, actual_end)
                    if next_space != -1 and (next_space - next_start) <= 20:
                        next_start = next_space + 1

        start = next_start

    return chunks


def extract_pdf_pages(pdf_source: bytes | BinaryIO | str | Path) -> List[Dict[str, Any]]:
    """Extract page number and text content from a PDF document using pypdf.

    Args:
        pdf_source: Raw bytes, binary stream, or file path to the PDF.

    Returns:
        List of dicts: `[{"page_number": 1, "text": "Page content..."}, ...]`

    Raises:
        ValueError: Nếu file PDF bị hỏng, có mật khẩu bảo vệ hoặc không thể đọc.
    """
    try:
        if isinstance(pdf_source, bytes):
            stream = io.BytesIO(pdf_source)
            reader = pypdf.PdfReader(stream)
        elif isinstance(pdf_source, (str, Path)):
            reader = pypdf.PdfReader(str(pdf_source))
        else:
            reader = pypdf.PdfReader(pdf_source)

        if reader.is_encrypted:
            try:
                # Thử giải mã nếu tài liệu dùng empty password
                reader.decrypt("")
            except Exception:
                raise ValueError("File PDF đã được đặt mật khẩu bảo vệ. Vui lòng tải lên tài liệu không có mật khẩu.")

        pages_data: List[Dict[str, Any]] = []
        for idx, page in enumerate(reader.pages):
            page_num = idx + 1
            try:
                page_text = page.extract_text() or ""
            except Exception:
                page_text = ""
            # Clean extra null/control chars
            page_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", page_text).strip()
            pages_data.append({
                "page_number": page_num,
                "text": page_text,
            })

        if not pages_data:
            raise ValueError("File PDF không chứa trang nội dung nào.")

        return pages_data

    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Không thể đọc nội dung file PDF (file bị lỗi cấu trúc hoặc hỏng): {exc}")


def chunk_pdf_document(
    article_id: int | str,
    article_public_id: str,
    article_title: str,
    slug: str,
    category: str,
    file_url: str,
    pages: List[Dict[str, Any]],
    chunk_size: int = 600,
    chunk_overlap: int = 100,
) -> List[Dict[str, Any]]:
    """Chunk pages of a PDF document into structured chunks with page number tracking.

    Args:
        article_id: Database internal ID.
        article_public_id: Public UUID.
        article_title: Title of the document.
        slug: URL-friendly slug.
        category: Document category (e.g. RETURN_REFUND, SHIPPING).
        file_url: URL to download/view the PDF.
        pages: List of page dicts from `extract_pdf_pages`.
        chunk_size: Maximum characters per chunk.
        chunk_overlap: Overlapping characters.

    Returns:
        List of chunk dicts ready for Elasticsearch indexing.
    """
    if not pages:
        return []

    result_chunks: List[Dict[str, Any]] = []
    global_chunk_idx = 0

    for page_info in pages:
        page_num = page_info.get("page_number", 1)
        page_text = (page_info.get("text") or "").strip()
        if not page_text:
            continue

        sub_chunks = _split_text_with_overlap(page_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        for sub_idx, sub_text in enumerate(sub_chunks):
            chunk_item = {
                "chunk_id": f"art_{article_id}_p{page_num}_c{sub_idx}",
                "article_id": str(article_id),
                "article_public_id": str(article_public_id),
                "article_title": article_title,
                "slug": slug,
                "section_title": f"Trang {page_num}",
                "category": category,
                "page_number": page_num,
                "file_url": file_url,
                "chunk_index": global_chunk_idx,
                "chunk_text": f"[{article_title} - Trang {page_num}]\n{sub_text}",
            }
            result_chunks.append(chunk_item)
            global_chunk_idx += 1

    return result_chunks


def parse_pages_from_extracted_text(text: str | None) -> List[Dict[str, Any]]:
    """Reconstruct structured pages from a formatted extracted_text string stored in the database.

    Handles strings formatted with '[Trang X]' page headers, returning `[{"page_number": X, "text": "..."}]`.
    Falls back gracefully to a single page if no page markers are present.
    """
    if not text or not text.strip():
        return []

    pattern = re.compile(
        r"\[Trang\s+(\d+)\]\s*\n([\s\S]*?)(?=(?:\[Trang\s+\d+\]\s*\n|$))",
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(text))
    if not matches:
        return [{"page_number": 1, "text": text.strip()}]

    pages: List[Dict[str, Any]] = []
    for match in matches:
        page_num = int(match.group(1))
        page_text = match.group(2).strip()
        if page_text:
            pages.append({"page_number": page_num, "text": page_text})

    return pages or [{"page_number": 1, "text": text.strip()}]

