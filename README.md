# Cell Culture Confluency Tracker

Track confluency readings for wells on cell culture plates.

See [CLAUDE.md](CLAUDE.md) for the agreed data model, API surface and
constraints.

## Layout

| Path        | What                                                       |
| ----------- | ---------------------------------------------------------- |
| `backend/`  | Django + Django Ninja API, managed with `uv`                |
| `frontend/` | Vite + React + TypeScript, TanStack Query, managed with `pnpm` |

## Setup

Two paths. They differ only in the database.

| | Docker | Native |
| --- | --- | --- |
| Database | Postgres 16 in a container | SQLite file at `backend/db.sqlite3` |
| Needs | Docker with Compose v2 | uv, Node 22+, pnpm |
| Use it when | You want the app running now, or you want to exercise the Postgres path | You are working on the code — faster reloads, no image rebuilds, a debugger that just attaches |

### Docker

```bash
docker compose up
```

That is the whole command from a clean clone. There is no pre-step and no
manual migrate: the backend container waits for Postgres to pass its
healthcheck, runs `migrate` in its entrypoint — which applies the seed data,
since `0002` and `0003` are data migrations — and then serves. The frontend
waits for the backend's healthcheck before starting.

- UI: http://localhost:5173
- API docs: http://localhost:8000/api/docs

`make` has shortcuts (`up`, `down`, `logs`, `clean`, `rebuild`, `test`), but
plain `docker compose up` is the supported command and nothing depends on
`make`.

Source is bind-mounted, so edits on the host reload in place: the frontend
in about 130ms over HMR without a page reload, the backend in about four
seconds via Django's `StatReloader`.

**One caveat, and it is about where the repo lives, not about compose.** A
bind mount only delivers inotify events if the host filesystem is Linux. Keep
the repo on the Linux side — including the WSL filesystem rather than
`/mnt/c` — and frontend hot reload works with no configuration. Run it from a
Windows or macOS filesystem through Docker Desktop and the container still
sees the edits, but no event ever fires and the page does not update.

There is no fix for that second case here. The usual one — polling the
filesystem instead of watching it — does not work on Vite 8: the dev server
watches through rolldown's native watcher, and `server.watch.usePolling`
survives only in the type definitions. Nothing in `vite/dist` reads it, and
`CHOKIDAR_USEPOLLING` does not reach it either. Both were measured, with and
without, before being left out of the compose file rather than shipped as
settings that do nothing. If you are on that path, use the native setup below
for frontend work, or `docker compose restart frontend` to pick up a change.

To start over from an empty database, `make clean` (or
`docker compose down --volumes`) drops the volume; the next `up` migrates
and seeds again.

### Native

```bash
cd backend  && uv sync && uv run python manage.py migrate && cd ..
cd frontend && pnpm install && cd ..
```

Then two terminals:

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

### How one settings file serves both

`DATABASE_URL` decides. Set (compose sets it, and any deployment would),
it is Postgres; unset, it is the SQLite file next to `manage.py`. Nothing
else in the app knows which one it got, and the test suite passes on both.

Parsing is `dj-database-url` rather than ten lines of `urlparse`. The ten
lines are easy to write and easy to get subtly wrong — percent-encoded
passwords, the `postgres://` and `postgresql://` scheme aliases, a missing
port defaulting correctly, and the `?sslmode=require` that a managed
Postgres will require the day this is deployed. It is a parser for someone
else's format, not an abstraction over ours, so the "no speculative
abstraction" rule in [CLAUDE.md](CLAUDE.md) does not apply: the dependency
has no transitive weight and removes a class of bug rather than adding a
layer.

`ALLOWED_HOSTS` gains hostnames from `DJANGO_ALLOWED_HOSTS` rather than
becoming `["*"]`, because Vite proxies with `changeOrigin`, so the Host
header Django sees under compose is `backend:8000`. `CSRF_TRUSTED_ORIGINS`
is declared for the same reason, though nothing is CSRF-protected today.

The Postgres credentials in `docker-compose.yml` are development defaults,
committed on purpose so a clean clone needs no `.env`. They are not secrets:
the database is only reachable on the compose network, and no deployment
would use them.

## Tests and checks

```bash
cd backend  && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && pnpm test && pnpm typecheck && pnpm lint
```

`uv run pytest` uses SQLite. For the same suite on Postgres:

```bash
make test-postgres     # docker compose run --rm --entrypoint pytest backend -q
```

or `make test` for both in sequence.

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

## What would change for production

The compose setup is a development environment and is built like one. What
it does differently from something deployed, specific to this app:

**The frontend is a Vite dev server.** It compiles on demand, serves
unminified modules and ships a HMR client. Production is a multi-stage
build — `pnpm build` in a builder stage, the `dist/` output copied into an
nginx or Caddy image — so the browser gets hashed, compressed,
long-cache-header assets from a real static server. That also removes the
dev proxy: `/api` would be routed by the same server or an ingress rather
than by Vite, which is the only reason `changeOrigin` and the
`DJANGO_ALLOWED_HOSTS` entry for `backend` exist at all.

**The backend is `runserver`.** Single-threaded, auto-reloading, and
explicitly not for production. It becomes gunicorn with several workers
behind the same static server. `DEBUG` off — which for this app matters
particularly, because `DEBUG=True` makes Django hold every SQL query it
runs in memory, and the plate-wells endpoint is deliberately three queries
regardless of well count. `SECRET_KEY` comes from the environment with the
in-file default deleted rather than defaulted, so a missing value fails
loudly instead of silently signing with a key that is in the repository.

**Migrations move out of the entrypoint.** They are there so that
`docker compose up` is one command, and that trick does not survive more
than one app instance: N containers starting together would all run
`migrate` against the same database at once. Production runs it as a
release step that completes before the new instances take traffic. The
seed migrations (`0002`, `0003`) would not ship at all — they exist to make
a clone demonstrable, and a real deployment starts with an empty plate
list, so they would be moved behind a management command or dropped.

**Postgres is managed, not a container with a local volume.** `db-data`
is a named volume on one machine: no backups, no failover, and gone with
`docker compose down --volumes`. Production uses RDS or Cloud SQL with
automated backups and point-in-time recovery, and `DATABASE_URL` gains
`?sslmode=require` — which the `dj-database-url` parsing above already
handles. `CONN_MAX_AGE` is set to 600 already; behind a real connection
pooler that would be revisited, since gunicorn workers times instances
times held connections is how Postgres runs out of them.

**Containers run as root and track floating tags.** `postgres:16-alpine`
and `node:22-bookworm-slim` move under you; production pins digests so a
rebuild is reproducible, and adds a non-root `USER` with the source owned
by it. Root is tolerable here only because bind mounts and host UID
mismatches make non-root genuinely annoying in development — though it
cuts both ways: running the suite in the container writes a root-owned
`backend/.pytest_cache` into the mounted tree, which the host user then
cannot delete. Adding the cache directories to `.dockerignore` does not
help, since the mount is what puts them there.

**Healthchecks are liveness, not readiness.** The two in the compose file
answer "is the process up" and are what orders startup. A scheduler needs
both: liveness to restart a wedged container, and readiness to keep an
instance out of the load balancer while it is still starting or has lost
the database. `/api/health` currently returns `{"status": "ok"}` without
touching Postgres, so it would be split — a readiness variant that runs
`SELECT 1` and fails when the database is unreachable, and a liveness one
that stays cheap.

**Observability, of which there is none.** Django logs to stdout in the
default format and nothing else exists. Structured JSON logs with a request
id, error tracking (Sentry), and metrics on request rate, latency and
database time. For this app specifically the thing worth watching is the
plate-wells endpoint: it is three queries by design and the regression
that matters is it quietly becoming three-plus-one-per-well, so its query
count and p99 latency against plate size are the numbers to alert on. The
test suite asserts the query count, but only on the sizes it tests.

**Backups.** Managed Postgres automated backups plus a periodic logical
dump held somewhere else, and — the half people skip — a restore actually
rehearsed. Measurements are append-only with soft deletes, so the data has
some of its own history, but that is a correction trail, not a backup: it
does not survive a dropped table.
