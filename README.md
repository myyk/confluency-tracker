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

Working end to end. `migrate` seeds ten 6-well plates with partial history,
the API serves them, and the microplate view renders any plate size.

### Where the interesting bits live

| Concern | File |
| --- | --- |
| Latest-reading resolution (two stacked windows) | `backend/plates/api.py` |
| Demo data | `backend/plates/migrations/0002_seed_demo_plates.py` |
| Confluency bands (single source of truth) | `frontend/src/lib/confluency.ts` |
| Well labels, A1 → BC42 | `frontend/src/lib/wellLabel.ts` |
| Hand-written API types | `frontend/src/api/types.ts` |

### Notes

Well labels are derived from `row_index`/`col_index` in the frontend and
never stored, and the grid is sized from `row_count`/`col_count`, so a
96-well plate is a row in the database rather than a code change.

Band colours are a validated palette: the four hues clear colourblind and
normal-vision separation in both light and dark. Colour is never the only
signal — every well carries its number, its band name and a distinct glyph,
and a never-measured well is hatched and dashed rather than merely grey.
