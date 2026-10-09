#!/bin/sh
# Runs from the nginx image entrypoint (/docker-entrypoint.d) at container start: writes config.json from the
# environment so one image serves every environment (FR-003). API_URL defaults to / (API on the same origin).
set -eu

api_url=$(printf '%s' "${API_URL:-/}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{ "apiUrl": "%s" }\n' "$api_url" > /usr/share/nginx/html/admin/config.json
