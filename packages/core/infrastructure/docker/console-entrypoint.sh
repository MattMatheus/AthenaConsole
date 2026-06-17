#!/bin/sh
set -eu

if [ -z "${ATHENA_AUTH_API_TOKEN:-}" ]; then
  echo "ATHENA_AUTH_API_TOKEN must be set for the console proxy." >&2
  exit 1
fi

if [ -z "${ATHENA_CONSOLE_PASSWORD:-}" ]; then
  echo "ATHENA_CONSOLE_PASSWORD must be set for console access." >&2
  exit 1
fi

case "$ATHENA_AUTH_API_TOKEN" in
  *[!A-Za-z0-9._~+/-=]*)
    echo "ATHENA_AUTH_API_TOKEN contains characters that are unsafe for an HTTP bearer header." >&2
    exit 1
    ;;
esac

htpasswd -Bbc /etc/nginx/athena.htpasswd operator "$ATHENA_CONSOLE_PASSWORD" >/dev/null

sed "s|\${ATHENA_AUTH_API_TOKEN}|${ATHENA_AUTH_API_TOKEN}|g" \
  /etc/nginx/templates/athena-console.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
