

# Directory

## Directory structure

```
ragatoni/
├── README.md
├── plan/
├── frontend/
└── backend/
    ├── .env
    ├── Dockerfile
    ├── docker-compose.yml
    ├── requirements.txt
    ├── app/
    │   ├── api/
    │   │   ├── main.py
    │   │   └── routes/
    │   └── celery/
    │       ├── worker.py
    │       └── tasks.py
    ├── config/
    │   ├── garage.toml
    │   ├── redis.conf
    │   ├── postgres-init/
    │   │   └── 001-init.sql
    │   └── README.md
    └── migrations/
```

## What each part is

- `README.md` — how the project runs.
- `plan/` — planning notes and the dashboard mock.
- `frontend/` — the React, TypeScript, Tailwind, and Vite app.
- `backend/` — the API, the worker, and the files that run them.
- `backend/.env` — secrets and service URLs for the API and the worker.
- `backend/Dockerfile` — image used by the API and the Celery worker.
- `backend/docker-compose.yml` — API, Celery worker, Postgres, Redis, and Garage.
- `backend/requirements.txt` — Python packages for that image.
- `backend/app/` — Python source for the two processes that run code.
- `backend/app/api/` — the web server.
- `backend/app/api/main.py` — FastAPI entrypoint.
- `backend/app/api/routes/` — HTTP routes.
- `backend/app/celery/` — the background worker.
- `backend/app/celery/worker.py` — Celery worker entrypoint.
- `backend/app/celery/tasks.py` — extract, chunk, and embed tasks.
- `backend/config/` — Postgres, Redis, and Garage setup.
- `backend/config/garage.toml` — single-node Garage config: data directory, RPC listen address, S3 listen address, and zone `dc1`.
- `backend/config/redis.conf` — Redis bind address and port.
- `backend/config/postgres-init/` — SQL that Postgres runs on first boot.
- `backend/config/postgres-init/001-init.sql` — placeholder for the first migration and any seed data.
- `backend/config/README.md` — what the config files are for.
- `backend/migrations/` — database migrations after first boot.
