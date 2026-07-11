#!/bin/sh
set -eu

python - <<'PY'
import os
import socket
import time
from urllib.parse import urlparse


def wait_for_tcp(name, host, port, timeout=60):
    if not host or not port:
        return
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        try:
            with socket.create_connection((host, int(port)), timeout=2):
                print(f"{name} is available at {host}:{port}", flush=True)
                return
        except OSError as exc:
            last_error = exc
            time.sleep(1)
    raise SystemExit(f"Timed out waiting for {name} at {host}:{port}: {last_error}")


if os.getenv("DATABASE_ENGINE") != "sqlite":
    wait_for_tcp(
        "PostgreSQL",
        os.getenv("POSTGRES_HOST", "db"),
        os.getenv("POSTGRES_PORT", "5432"),
    )

redis_url = os.getenv("REDIS_URL") or os.getenv("CELERY_BROKER_URL")
if redis_url:
    parsed = urlparse(redis_url)
    wait_for_tcp("Redis", parsed.hostname, parsed.port or 6379)
PY

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
fi

if [ "${COLLECTSTATIC:-0}" = "1" ]; then
  python manage.py collectstatic --noinput
fi

exec "$@"
