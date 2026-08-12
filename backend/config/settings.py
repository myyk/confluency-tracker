"""
Django settings for the confluency tracker backend.

No auth, no users — the app is a single-tenant take-home, so the auth,
admin, sessions and messages apps are deliberately not installed.
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def _csv(name, default=""):
    """A comma-separated env var as a list, empty entries dropped."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# SECURITY WARNING: dev-only key; this project is not deployed. It stays in the
# file as the default so a clone runs with no environment set up at all -- in
# anything real this is read from a secret manager and the default is removed.
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-4jk$23u9o^wwutn5dt_gvc4#8brcs@2yr*0k&=l-bu105sx)b+",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# The compose frontend proxies to the backend by service name, so the Host
# header arriving at Django is `backend:8000` rather than localhost. Named
# rather than switched off: an env var adds the hostnames a deployment needs
# without turning the check into `["*"]`.
ALLOWED_HOSTS = ["localhost", "127.0.0.1", *_csv("DJANGO_ALLOWED_HOSTS")]

# Nothing here is CSRF-protected today -- the API is unauthenticated and
# CsrfViewMiddleware is not installed -- but the origins are declared anyway so
# that adding a session, a form or the admin later does not fail confusingly
# under compose, where the browser's origin is :5173 and Django's is :8000.
CSRF_TRUSTED_ORIGINS = _csv(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000",
)

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "plates",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# One knob, two paths: DATABASE_URL set (compose, any deployment) means
# Postgres, unset (a plain clone) means the SQLite file next to manage.py.
# Nothing else in the app knows which it got.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        # Held-open connections are wasted on SQLite and wanted on Postgres;
        # harmless on the former, so it stays unconditional.
        conn_max_age=600,
        conn_health_checks=True,
    )
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
