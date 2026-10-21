<!-- rag-a-toni/README.md -->

# RAG-a-toni

A local web app for learning retrieval-augmented generation step by step. The screen walks through upload, extract, chunk, embed, store, and ask. Each pipeline stage after upload is a separate Python module.

Source: https://github.com/Rhiino/ragatoni

## Project description

The frontend shows six steps and marks the active one. A header and footer frame the page. Once Ask is open, those steps can be clicked to move between stages. Upload is first. It accepts one document by drop or file picker, sends that file to the API, and the page moves to Extract. Extract reads the text from a PDF, Markdown, or plain text file and shows it in a scrolling box. Continue sits at the top right on Extract, Chunk, and Embed. Continue on Extract moves to Chunk. Chunk takes a character size and an overlap, sends the extracted text to the API, and shows the passages with a summary of the split. Those numbers can be changed and sent again. Continue on Chunk becomes available once the passages exist, then moves to Embed. Embed offers five OpenAI embedding choices in a custom menu, each with its dimension count and price per million tokens. Embed sends the passages to the API, which calls that model and shows the token count, the cost, and a short preview of each vector. Continue on Embed stores those passages in Postgres and opens Store. Store plays a green check as the save starts and confirms the document when the save finishes. Continue at the top right of Store opens Ask. Ask offers five OpenAI chat models in the same kind of menu, each with its input and output price per million tokens. After a model is selected, the page is a chat. Each reply can search and read the stored document, and the turn shows its cost. A browser session id is kept locally and stored with each document. Reloading loads that session's documents. When the session has stored documents, Upload shows Upload and Choose file instead of the drop zone. Choose file lists those documents, and Continue opens Ask for the selected one. A session with no stored documents still sees the drop zone. The FastAPI backend exposes a health check plus upload, chunk, embed, store, list, and ask.

## Project dependencies

- Python 3.10+
- Node.js and npm
- Docker (Postgres and Adminer)

Backend Python packages are listed in `backend/requirements.txt`, including `openai` for embed and ask, and `psycopg` for Postgres. The frontend uses Vite and React.

## Project directory structure

```
rag-a-toni/
├── README.md
├── rag-a-toni-api.service
├── rag-a-toni-web.service
├── .gitignore
├── .cursor/
│   └── rules/
│       └── blast-radius.mdc
├── docker-compose.yml
├── backend/
│   ├── requirements.txt
│   ├── .env
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
    └── src/
        ├── App.tsx
        ├── main.tsx
        └── styles.css
```

Before an agent creates, updates, or deletes files in this tree, it shows a review table and waits for confirmation. That workflow is in `.cursor/rules/blast-radius.mdc`.

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

## Quick start

1. Set `OPENAI_API_KEY` in `backend/.env` when you reach embedding and chat steps.

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

Open http://127.0.0.1:5188 for the home page. API health: http://127.0.0.1:8015/health

Public URL (via Cloudflare tunnel and Caddy): https://ragatoni.noteinstein.org — UI on port 5188; browser calls to `/api/*` are routed to the API on 8015. Database UI: https://ragatonidb.noteinstein.org (Adminer on port 9029).

5. Keep it running on Ryon (optional):

```bash
cp rag-a-toni-api.service rag-a-toni-web.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now rag-a-toni-api.service rag-a-toni-web.service
```

Reload Caddy after changing `caddy/Caddyfile`:

```bash
/usr/local/bin/caddy reload --config /home/mittens/Documents/myrepos/caddy/Caddyfile
```

6. Postgres and Adminer:

```bash
docker compose --env-file backend/.env up -d
```

Database URL defaults to `postgresql+psycopg://rag:rag@127.0.0.1:5439/rag_a_toni` in `backend/.env`. Adminer is at https://ragatonidb.noteinstein.org. Sign in with system PostgreSQL, server `db`, and the `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` values from that file.
