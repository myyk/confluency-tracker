# Cell Culture Confluency Tracker

Track confluency readings for wells on cell culture plates.

See [CLAUDE.md](CLAUDE.md) for the agreed data model, API surface and
constraints.

## Layout

| Path        | What                                                       |
| ----------- | ---------------------------------------------------------- |
| `backend/`  | Django + Django Ninja API on SQLite, managed with `uv`      |
| `frontend/` | Vite + React + TypeScript, TanStack Query, managed with `pnpm` |

## Prerequisites

- [uv](https://docs.astral.sh/uv/)
- Node 22+ and [pnpm](https://pnpm.io/)

## Setup

```bash
cd backend  && uv sync && uv run python manage.py migrate && cd ..
cd frontend && pnpm install && cd ..
```

## Running

Two terminals:

```bash
# terminal 1 — API on http://127.0.0.1:8000
cd backend && uv run python manage.py runserver

# terminal 2 — UI on http://localhost:5173
cd frontend && pnpm dev
```

Vite proxies `/api` to the Django dev server, so the browser only ever
talks to one origin and there is no CORS configuration.

- API docs: http://127.0.0.1:8000/api/docs
- Health check: http://127.0.0.1:8000/api/health

## Tests and checks

```bash
cd backend  && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && pnpm test && pnpm typecheck && pnpm lint
```

## Status

Scaffold only — no domain logic yet. Models, endpoints and UI are still
to be built.
