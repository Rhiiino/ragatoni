# rag-a-toni/backend/src/core/db.py

"""Postgres connection and the documents/chunks schema."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from core.config import settings

_ready = False

_STATEMENTS = (
    "CREATE EXTENSION IF NOT EXISTS vector",
    """
    CREATE TABLE IF NOT EXISTS documents (
        id uuid PRIMARY KEY,
        session_id text NOT NULL,
        filename text NOT NULL,
        embedding_model text NOT NULL,
        dimensions integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (session_id, filename)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS chunks (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
        chunk_index integer NOT NULL,
        heading text NOT NULL DEFAULT '',
        body text NOT NULL,
        embedding vector NOT NULL,
        UNIQUE (document_id, chunk_index)
    )
    """,
    "CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id)",
)


def database_url() -> str:
    url = settings.database_url
    prefix = "postgresql+psycopg://"
    if url.startswith(prefix):
        return "postgresql://" + url[len(prefix) :]
    return url


def parse_session_id(value: str) -> str:
    try:
        return str(uuid.UUID(value.strip()))
    except ValueError as exc:
        raise ValueError("The session id is not valid.") from exc


def parse_document_id(value: str) -> str:
    try:
        return str(uuid.UUID(value.strip()))
    except ValueError as exc:
        raise ValueError("That document id is not valid.") from exc


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        _ensure_schema(conn)
        yield conn


def _ensure_schema(conn: psycopg.Connection) -> None:
    global _ready
    if _ready:
        return
    for statement in _STATEMENTS:
        conn.execute(statement)
    conn.commit()
    _ready = True
