# Project: Cell Culture Confluency Tracker (take-home)

## Constraints
- Backend: Django + Django Ninja. Frontend: React + TypeScript (Vite).
- DB: SQLite. Deps: uv (backend), pnpm (frontend).
- Versions: Use latest versions.
- Budget: ~4h core. Prioritise a coherent working slice over breadth.
- NO speculative abstraction: no service layer, no repository pattern, no
  DRF, no custom base classes. Ninja routers call the ORM directly.
- No auth, no users.

## Data model (decided — do not redesign)
- Plate(name, row_count, col_count, created_at)
- Well(plate FK, row_index, col_index) — unique(plate, row_index, col_index).
  Label (A1) is DERIVED from indices, never stored. This is what makes
  96-well plates a data change, not a code change.
- Measurement(well FK, value, recorded_at, created_at, updated_at, deleted_at)
  - value: integer 0..100 inclusive
  - append-only history; "latest" = max(recorded_at), tie-break on id DESC
  - a correction creates a new measurement (keeps old created_at, updates updated_at)
  - a delete adds the deleted_at

## API (decided)
- GET    /api/plates                       -> id, name, dims, well count,
                                              last_reading_at
- GET    /api/plates/{id}                  -> single plate + dims
- GET    /api/plates/{id}/wells            -> every well + its latest
                                              measurement (or null)
- GET    /api/plates/{id}/wells/{wellid}/measurements      -> full history, newest first
- POST   /api/plates/{id}/wells/{wellid}/measurements      -> {value, recorded_at?} -> 201
- PATCH  /api/measurements/{id}            -> {value, recorded_at?}
- DELETE /api/measurements/{id}            -> 204, soft delete

## Rules
- The plate-wells endpoint must be O(1) queries — use a window function or
  Subquery annotation. Never loop wells and query per well.
- Validation lives in two places, deliberately: Ninja schema (ge=0, le=100)
  for the 400 response, and a DB CheckConstraint as the backstop.
- Confluency display bands: [0,20) very low, [20,60) growing,
  [60,90] optimal, (90,100] over-confluent, null = no data.
  Band logic lives in ONE frontend module, tested.
- After any change, run the tests and the type checker. Report failures;
  don't paper over them.