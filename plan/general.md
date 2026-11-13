# General

General development / process plan.

## Product definition (Product name, who uses it, etc.)

Ragatoni. This application is meant to demonstrate Retreival augmented generation (RAG) with its various types, allowing users to quickly get upto speed on its use cases and how it can be leveraged into ones developmental workflows.

---

## Functional definition (Features & behaviors, others.)

- Users should be able to upload a document of their choice and and vcisualize the pipeline involved in the vector index.
- Allow selection from various types of RAG (naive, hyrid, etc.) when building index.
- Documenst users upload should persist and be saved. Tie document ownership to sessions (to avoid user signup).

---

## Technical requirements (Stack, infrastructure, hosting, APIs, etc.)

- Stack
  - Backend
    - Docker
    - Python 3.13
    - FastAPI (REST)
    - PostgresSQL + PGVector
    - PyMuPDF
    - PyPlumber
    - Redis (Caching, queuing, supply workers)
    - Celery (Manage & run background tasks)
    - Pydantic (Request / response schemas)
    - Garage S3
  - Frontend
    - React.js (UI + routing)
    - Typescript
    - TailwindCSS
    - Vite (Server)
- .env handles secrets/API keys
- 20 concurrent users (documents embedded simultaneously)
- Browser support: TBD

---

## System design / architecture

- Distributed system
  - Dedicated back & frontend
  - Containerized backend services
    - API
    - DB (Postgres + PGvector)
    - Redis
    - Celery (worker)
    - Garage (S3)
- Authentication
  - Opaque server side session
- DB schema
  - sessions
    - id
    - created at
    - updated at
    - session token
    - expires at
    - last seen
    - preferences
  - documents
    - id
    - created at
    - updated at
    - status
    - name
    - size
    - session id
    - total token
    - content type / mimetype
    - object key (points to s3 resource)
  - chunks
    - id
    - created at
    - updated at
    - document id
    - token count
    - chunk index
    - page list (json b)
  - embeddings
    - id
    - created at
    - updated at
    - chunk id
    - embedding model id
  - embedding model
    - id
    - created at
    - updated at
    - name
    - provider
    - dimension
    - max input token

## Pages

- Just one page, the dashboard, with multiple panels

## Panels

- Documents
  - Persistent central panel. Lists the session's documents
  - Columns: name, status, size, upload date, action, menu
  - Action: Chunk opens chunk creation. Query opens the query panel
  - Menu is three dots. Edit renames the document. Delete removes the document and its chunks and embeddings
- Settings
  - Gear in the documents header. Replaces the documents list in that same slot
  - Embedding model
  - PDF library: PyMuPDF or PyPlumber, with room for more later
  - Both choices are stored in `sessions.preferences` (JSONB)
  - Each config header has an eye inside a circle on its right. Hover shows that config's description. Later configs on this panel use the same pattern (`mock/dashboard.md`)
- Chunk creation
  - Opens from the Chunk button
  - Shows the document's total token count
  - Configs: tokens per chunk, chunk overlap
  - Shows the chunk count and the overlap in tokens
  - Confirm creates the chunks and starts embedding, using those configs and the settings preferences
- Chunks
  - Lists that document's chunks
  - Columns: index, tokens, text preview, embedded (boolean)
  - A row opens the hybrid panel
- Preview / embedding hybrid panel
  - Preview tab shows the PDF page for the chunk
  - Embedding tab shows the vector values when the chunk has an embedding
  - Opens from a chunks row or a results row
- Query
  - Opens from the Query button
  - Search box
  - Retrieval type: naive is semantic search. Hybrid is BM25 keyword search plus semantic search
  - Top K
  - Score threshold: the minimum score for a chunk
  - Search opens the results panel
- Results
  - Lists the search hits
  - Naive shows the naive score. Hybrid shows the BM25 score, the dense score, and the reciprocal rank fusion score
  - Columns: rank, chunk text, score, chunk index
  - A row opens the hybrid panel

