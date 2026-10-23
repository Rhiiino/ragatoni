# ragatoni/backend/src/pipeline/03_embed.py

"""Step 3: embed chunk text with an OpenAI embedding model."""

from typing import TypedDict

from openai import OpenAI, OpenAIError

from core.config import settings


class EmbedChoice(TypedDict):
    model: str
    dimensions: int
    price_per_million: float


class EmbedError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


CHOICES: tuple[EmbedChoice, ...] = (
    {"model": "text-embedding-3-small", "dimensions": 1536, "price_per_million": 0.02},
    {"model": "text-embedding-3-small", "dimensions": 512, "price_per_million": 0.02},
    {"model": "text-embedding-3-large", "dimensions": 3072, "price_per_million": 0.13},
    {"model": "text-embedding-3-large", "dimensions": 1024, "price_per_million": 0.13},
    {"model": "text-embedding-ada-002", "dimensions": 1536, "price_per_million": 0.10},
)

_BATCH = 128


def embed_chunks(chunks: list[dict], model: str, dimensions: int) -> dict:
    choice = _choice(model, dimensions)
    if not chunks:
        raise EmbedError("Chunk the document before embedding.")
    texts: list[str] = []
    for chunk in chunks:
        text = chunk.get("text")
        if not isinstance(text, str) or not text.strip():
            raise EmbedError("Every chunk needs text before it can be embedded.")
        texts.append(text)
    if not settings.openai_api_key:
        raise EmbedError("Set OPENAI_API_KEY before embedding.")

    client = OpenAI(api_key=settings.openai_api_key, timeout=60.0)
    vectors: list[list[float]] = []
    tokens = 0
    try:
        for start in range(0, len(texts), _BATCH):
            batch = texts[start : start + _BATCH]
            kwargs: dict = {"model": choice["model"], "input": batch, "encoding_format": "float"}
            if choice["model"] != "text-embedding-ada-002":
                kwargs["dimensions"] = choice["dimensions"]
            response = client.embeddings.create(**kwargs)
            ordered = sorted(response.data, key=lambda item: item.index)
            vectors.extend(item.embedding for item in ordered)
            usage = response.usage
            tokens += int(getattr(usage, "total_tokens", 0) or 0)
    except OpenAIError as exc:
        raise EmbedError(_public_error(exc), status_code=502) from exc

    if len(vectors) != len(chunks):
        raise EmbedError("The embedding response did not match the chunks.", status_code=502)

    width = len(vectors[0]) if vectors else choice["dimensions"]
    embeddings = [
        {
            "index": chunk.get("index"),
            "heading": chunk.get("heading") or "",
            "filename": chunk.get("filename") or "",
            "dimensions": len(vector),
            "vector": vector,
        }
        for chunk, vector in zip(chunks, vectors)
    ]
    price = choice["price_per_million"]
    return {
        "embeddings": embeddings,
        "summary": {
            "model": choice["model"],
            "dimensions": width,
            "count": len(embeddings),
            "tokens": tokens,
            "price_per_million": price,
            "cost": round(tokens * price / 1_000_000, 8),
        },
    }


def _choice(model: str, dimensions: int) -> EmbedChoice:
    for choice in CHOICES:
        if choice["model"] == model and choice["dimensions"] == dimensions:
            return choice
    raise EmbedError("Choose one of the listed embedding models.")


def _public_error(exc: OpenAIError) -> str:
    message = str(exc).lower()
    if "sk-" in message or "api key" in message or "401" in message:
        return "The OpenAI API key was rejected."
    if "429" in message:
        return "OpenAI rate-limited the embedding request. Try again in a moment."
    return "The embedding request failed."
