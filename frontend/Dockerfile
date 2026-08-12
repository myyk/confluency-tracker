# Node's resolver walks up from the importing file, so node_modules has to sit
# inside /app -- it cannot be moved out of the way of the bind mount the way the
# Python environment can. compose therefore masks it back with an anonymous
# volume; see the comment on the frontend service in docker-compose.yml.
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

# Dependencies in their own layer. --frozen-lockfile fails rather than quietly
# resolving something new, so the image matches what the repo committed.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173
# --host so Vite binds 0.0.0.0 and the port publish actually reaches it; bound
# to localhost inside the container it would answer nothing from outside.
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
