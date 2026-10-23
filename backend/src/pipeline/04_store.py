# ragatoni/backend/src/pipeline/04_store.py

"""Step 4: persist chunk text, metadata, and vectors in Postgres with pgvector."""

import json
import math
import uuid
from datetime import datetime

from core.db import connect, parse_session_id


class StoreError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def store_document(
    session_id: str,
    filename: str,
    model: str,
    dimensions: int,
    chunks: list[dict],
) -> dict:
    session = _session(session_id)
    name = filename.strip() or "document"
    if not model.strip():
        raise StoreError("Choose an embedding model before storing.")
    if dimensions < 1:
        raise StoreError("The embedding dimensions are missing.")
    rows = _rows(chunks, dimensions)
    document_id = uuid.uuid4()

    with connect() as conn:
        conn.execute(
            "DELETE FROM documents WHERE session_id = %s AND filename = %s",
            (session, name),
        )
        inserted = conn.execute(
            """
            INSERT INTO documents (id, session_id, filename, embedding_model, dimensions)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, filename, embedding_model, dimensions, created_at
            """,
            (document_id, session, name, model.strip(), dimensions),
        ).fetchone()
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO chunks (document_id, chunk_index, heading, body, embedding)
                VALUES (%s, %s, %s, %s, %s::vector)
                """,
                [
                    (document_id, index, heading, text, json.dumps(vector))
                    for index, heading, text, vector in rows
                ],
            )
    if inserted is None:
        raise StoreError("The document could not be stored.", status_code=502)
    return _document_payload(inserted, len(rows))


def list_documents(session_id: str) -> dict:
    session = _session(session_id)
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                d.id,
                d.filename,
                d.embedding_model,
                d.dimensions,
                d.created_at,
                count(c.id) AS chunk_count
            FROM documents d
            LEFT JOIN chunks c ON c.document_id = d.id
            WHERE d.session_id = %s
            GROUP BY d.id
            ORDER BY d.created_at DESC, d.filename
            """,
            (session,),
        ).fetchall()
    return {"documents": [_document_payload(row, int(row["chunk_count"])) for row in rows]}


def _session(session_id: str) -> str:
    try:
        return parse_session_id(session_id)
    except ValueError as exc:
        raise StoreError(str(exc)) from exc


def _rows(chunks: list[dict], dimensions: int) -> list[tuple[int, str, str, list[float]]]:
    if not chunks:
        raise StoreError("Embed the document before storing it.")
    rows: list[tuple[int, str, str, list[float]]] = []
    seen: set[int] = set()
    for chunk in chunks:
        index = chunk.get("index")
        text = chunk.get("text")
        vector = chunk.get("vector")
        if not isinstance(index, int):
            raise StoreError("Every chunk needs an index.")
        if index in seen:
            raise StoreError("Chunk indexes must be unique.")
        seen.add(index)
        if not isinstance(text, str) or not text.strip():
            raise StoreError("Every chunk needs text before it can be stored.")
        if not isinstance(vector, list) or len(vector) != dimensions:
            raise StoreError("Every vector must match the embedding dimensions.")
        numbers: list[float] = []
        for value in vector:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
                raise StoreError("A vector contained a non-numeric value.")
            numbers.append(float(value))
        heading = chunk.get("heading") or ""
        if not isinstance(heading, str):
            heading = ""
        rows.append((index, heading, text, numbers))
    return rows


def _document_payload(row: dict, chunk_count: int) -> dict:
    created = row["created_at"]
    return {
        "id": str(row["id"]),
        "filename": row["filename"],
        "embedding_model": row["embedding_model"],
        "dimensions": int(row["dimensions"]),
        "chunk_count": chunk_count,
        "created_at": created.isoformat() if isinstance(created, datetime) else str(created),
    }
