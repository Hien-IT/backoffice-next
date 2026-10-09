#!/bin/sh
# Runs from the nginx image entrypoint (/docker-entrypoint.d) at container start: writes config.json from the
# environment so one image serves every environment (FR-003). The API URL is the Directus variable PUBLIC_URL
# (Principle VIII: same env file as Directus, no new variable); default / (API on the same origin).
set -eu

api_url=$(printf '%s' "${PUBLIC_URL:-/}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{ "apiUrl": "%s" }\n' "$api_url" > /usr/share/nginx/html/admin/config.json
