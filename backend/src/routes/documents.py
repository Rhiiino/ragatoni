# ragatoni/backend/src/routes/documents.py

"""HTTP entry for document uploads. The pipeline starts after the file bytes arrive."""

import importlib

from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(prefix="/documents", tags=["documents"])

extract_text = importlib.import_module("pipeline.01_extract").extract_text
chunk_text = importlib.import_module("pipeline.02_chunk").chunk_text
_embed = importlib.import_module("pipeline.03_embed")
embed_chunks = _embed.embed_chunks
EmbedError = _embed.EmbedError
_store = importlib.import_module("pipeline.04_store")
store_document = _store.store_document
list_documents = _store.list_documents
StoreError = _store.StoreError
_ask = importlib.import_module("pipeline.05_ask")
answer_question = _ask.answer_question
AskError = _ask.AskError


class ChunkRequest(BaseModel):
    text: str
    filename: str = ""
    chunk_size: int
    overlap: int


class EmbedChunk(BaseModel):
    index: int
    heading: str = ""
    filename: str = ""
    text: str


class EmbedRequest(BaseModel):
    model: str
    dimensions: int
    chunks: list[EmbedChunk]


class StoreChunk(BaseModel):
    index: int
    heading: str = ""
    text: str
    vector: list[float]


class StoreRequest(BaseModel):
    filename: str = ""
    model: str
    dimensions: int
    chunks: list[StoreChunk]


class ChatTurn(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    document_id: str
    model: str
    messages: list[ChatTurn]


@router.post("")
async def upload_document(file: UploadFile = File(...)) -> dict[str, str]:
    data = await file.read()
    try:
        text = extract_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"name": file.filename or "", "text": text}


@router.get("")
def stored_documents(x_session_id: str = Header()) -> dict:
    try:
        return list_documents(x_session_id)
    except StoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/chunk")
def chunk_document(body: ChunkRequest) -> dict:
    try:
        return chunk_text(body.text, body.chunk_size, body.overlap, body.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/embed")
def embed_document(body: EmbedRequest) -> dict:
    try:
        return embed_chunks([chunk.model_dump() for chunk in body.chunks], body.model, body.dimensions)
    except EmbedError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/store")
def store(body: StoreRequest, x_session_id: str = Header()) -> dict:
    try:
        return store_document(
            x_session_id,
            body.filename,
            body.model,
            body.dimensions,
            [chunk.model_dump() for chunk in body.chunks],
        )
    except StoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/ask")
def ask(body: AskRequest, x_session_id: str = Header()) -> dict:
    try:
        return answer_question(
            x_session_id,
            body.document_id,
            body.model,
            [message.model_dump() for message in body.messages],
        )
    except AskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
