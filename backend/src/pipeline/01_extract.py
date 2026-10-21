# rag-a-toni/backend/src/pipeline/01_extract.py

"""Step 1: extract plain text from an uploaded file (.txt, .md, or .pdf)."""

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PdfReadError

_TEXT_SUFFIXES = {".txt", ".md", ".markdown"}


def extract_text(filename: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in _TEXT_SUFFIXES:
        return _decode_text(data)
    if suffix == ".pdf":
        return _extract_pdf(data)
    raise ValueError("Upload a PDF, Markdown, or plain text file.")


def _decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("This text file is not UTF-8.") from exc


def _extract_pdf(data: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("This PDF is encrypted.")
        pages = [(page.extract_text() or "") for page in reader.pages]
    except PdfReadError as exc:
        raise ValueError("This PDF could not be read.") from exc
    return "\n".join(pages)
