# Ragatoni R2 — Backend Directory Structure

```yaml
backend/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── plan/                          # planning docs (unchanged)
└── app/
    ├── main.py                    # builds the FastAPI app, includes every router
    ├── config.py                  # shared settings: Postgres, Redis, Garage URLs
    └── modules/
        ├── documents/
        │   ├── router.py
        │   ├── schemas.py
        │   ├── service.py
        │   ├── repository.py
        │   └── config.py
        ├── retrieval/
        │   ├── router.py
        │   ├── schemas.py
        │   ├── service.py
        │   ├── repository.py
        │   └── config.py
        └── (other domain modules as needed)
```

Notes:
- No src/ folder. app/ sits at the backend root; the Compose build context is the backend root, so src would only add a path layer in the Dockerfile with no benefit at this scale.
- Each module follows the per-service template: router.py (API layer), schemas.py (request/response structures), service.py (business logic), repository.py (database reads/writes/updates/deletes), config.py (module-specific configuration).
- This is a modular monolith: each module has its own router but all run in the single FastAPI process. Celery tasks (app/celery) call into the same service modules so logic is not duplicated between sync and async paths.
- Services talk to Postgres, Redis, and Garage through the repository/client modules, keeping infrastructure details out of business rules.
