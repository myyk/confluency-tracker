#!/bin/sh
# Migrations run here rather than as a step the reader has to remember, which
# is what makes `docker compose up` the whole command. compose holds this back
# until the db healthcheck passes, so there is nothing to wait for.
#
# The seed data rides along: 0002 and 0003 are data migrations, so `migrate`
# leaves a database with plates in it rather than an empty schema.
#
# This is a development convenience and is called out in the README as one of
# the things production does differently -- there, migrations are a release
# step, because N app instances starting at once would all run this at once.
set -e

python manage.py migrate --noinput

exec "$@"
