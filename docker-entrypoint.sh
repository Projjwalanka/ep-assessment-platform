#!/bin/sh
# Make sure the data directory (possibly a freshly mounted disk owned by root) is writable,
# then run the app as the unprivileged "app" user so candidate code never runs as root.
set -e
mkdir -p "${DATA_DIR:-/app/data}"
chown -R app:app "${DATA_DIR:-/app/data}" 2>/dev/null || true
exec su-exec app sh -c "exec java $JAVA_OPTS -jar /app/app.jar"
