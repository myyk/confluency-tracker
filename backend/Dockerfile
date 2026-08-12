# The uv image rather than python:3.12-slim plus a uv install: the project is
# already uv-managed, and this way the lockfile is resolved by the same version
# of the same tool that resolved it on the host.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# The environment lives OUTSIDE /app on purpose. compose bind-mounts the source
# tree over /app so edits are picked up live, and anything installed inside that
# tree -- .venv included -- disappears under the mount the moment it does. Put
# it at /opt/venv and the mount cannot reach it.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Dependencies in their own layer, so editing a view does not reinstall Django.
# --locked fails loudly if pyproject.toml and uv.lock have drifted apart.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
