# Shortcuts only. `docker compose up` works on its own and is the documented
# command; nothing here is required to run the app.
.PHONY: up down logs rebuild clean test test-sqlite test-postgres

up:
	docker compose up

down:
	docker compose down

# Also drops the database volume, so the next `up` migrates and seeds from
# nothing. The way to get back to a fresh plate list.
clean:
	docker compose down --volumes

logs:
	docker compose logs --follow

# After a dependency change: the lockfile layers are cached on content, so a
# plain `up` would keep the old ones.
rebuild:
	docker compose build --no-cache

# The suite on both database paths, which is the thing that can quietly rot.
test: test-sqlite test-postgres

test-sqlite:
	cd backend && uv run pytest -q

# `run` starts db and waits on its healthcheck, same as `up` does, and takes
# DATABASE_URL from the backend service. --entrypoint skips the migrate step:
# pytest-django builds and tears down its own test database.
test-postgres:
	docker compose run --rm --entrypoint pytest backend -q
