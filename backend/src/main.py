# ragatoni/backend/src/main.py

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routes.documents import router as documents_router

# Off unless ENABLE_API_DOCS=true, so production does not publish Swagger, ReDoc, or the schema.
_API_DOCS_ENABLED = os.getenv("ENABLE_API_DOCS", "").strip().lower() in {"1", "true", "yes"}

app = FastAPI(
    title="RAG-a-toni API",
    description="Learning app for retrieval-augmented generation.",
    version="0.1.0",
    docs_url="/docs" if _API_DOCS_ENABLED else None,
    redoc_url="/redoc" if _API_DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _API_DOCS_ENABLED else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
