# ragatoni/backend/src/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routes.documents import router as documents_router

app = FastAPI(
    title="RAG-a-toni API",
    description="Learning app for retrieval-augmented generation.",
    version="0.1.0",
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
