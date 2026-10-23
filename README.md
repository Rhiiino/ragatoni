<!-- ragatoni/README.md -->

<p align="center">
  <img src="frontend/src/assets/ragatoni-logo.png" alt="RAG-a-toni" width="680" />
</p>

**Live demo:** [rag-toni.themidhunraj.com](https://rag-toni.themidhunraj.com)

RAG-a-toni is a step-by-step web app for learning retrieval-augmented generation. Upload a PDF, Markdown, or plain-text file, then walk through extract, chunk, embed, store, and ask. Each pipeline stage after upload is a separate Python module; the React UI shows one stage at a time and surfaces token counts and cost where OpenAI is used.

Source: [github.com/Rhiiino/ragatoni](https://github.com/Rhiiino/ragatoni)

## Project description

The app teaches RAG as a visible pipeline: text extraction, configurable chunking, embedding model choice, pgvector storage, and chat grounded on the stored passages. Sessions are tracked in the browser so you can return to stored documents and continue in Ask. The backend is FastAPI; the frontend is Vite and React.

## Project dependencies

- Python 3.10+
- Node.js and npm
- Docker (Postgres with pgvector)

Backend packages are in `backend/requirements.txt` (`openai`, `psycopg`, FastAPI, and related). The frontend uses Vite and React.

## Project directory structure

```
ragatoni/
├── README.md
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── main.py
│       ├── core/
│       │   ├── config.py
│       │   └── db.py
│       ├── routes/
│       │   └── documents.py
│       └── pipeline/
│           ├── 01_extract.py
│           ├── 02_chunk.py
│           ├── 03_embed.py
│           ├── 04_store.py
│           └── 05_ask.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── .env.example
    ├── server/
    │   └── keelPageVisits.mjs
    └── src/
        ├── App.tsx
        ├── main.tsx
        └── styles.css
```

## DB schema

Postgres with the `vector` extension. A document belongs to one browser session. Re-storing the same filename in that session replaces the document and its passages. `chunks.document_id` references `documents.id` and deletes with it.

### documents

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| session_id | text | Browser session. Unique together with filename |
| filename | text | Unique together with session_id |
| embedding_model | text | Model that produced the vectors |
| dimensions | integer | Length of each vector |
| created_at | timestamptz | When this copy was stored |

### chunks

| Column | Type | Notes |
|---|---|---|
| id | bigint | Primary key |
| document_id | uuid | References documents.id, cascade delete. Unique together with chunk_index |
| chunk_index | integer | Passage order. Unique together with document_id |
| heading | text | Heading captured during chunking |
| body | text | Passage text |
| embedding | vector | pgvector column. Length matches documents.dimensions |

## Configuration

Create `backend/.env` with at least:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Embedding and chat |
| `DATABASE_URL` | Postgres connection (default in `.env.example` matches Docker Compose on port 5439) |
| `CORS_ORIGINS` | Browser origins allowed to call the API (include your dev URL and production site if you deploy) |
| `KEEL_INGEST_TOKEN` | In `frontend/.env`. Server-only page-visit token for Keel. Do not prefix it with `VITE_` |

See `backend/.env.example` and `frontend/.env.example` for the other defaults.

## Quick start

1. Postgres (from repo root):

```bash
docker compose --env-file backend/.env up -d
```

2. Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8015 --app-dir src --reload
```

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5188](http://127.0.0.1:5188). API health: [http://127.0.0.1:8015/health](http://127.0.0.1:8015/health). The dev server proxies `/api` to the backend.
