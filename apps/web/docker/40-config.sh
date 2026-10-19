#!/bin/sh
# Runs from the nginx image entrypoint (/docker-entrypoint.d) at container start: writes config.json and the CSP header
# from the environment so one image serves every environment (FR-003 of 012, FR-005 of 019). The API URL is the Directus
# variable PUBLIC_URL (Principle VIII: same env file as Directus, no new variable); default / (API on the same origin).
set -eu

api_url=$(printf '%s' "${PUBLIC_URL:-/}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{ "apiUrl": "%s" }\n' "$api_url" > /usr/share/nginx/html/admin/config.json

# Same Content-Security-Policy as Directus sends for /admin with the same CONTENT_SECURITY_POLICY_* (csp.awk).
csp=$(env | LC_ALL=C sort | awk -f /etc/nginx/csp.awk)
printf 'add_header Content-Security-Policy "%s" always;\n' "$csp" > /etc/nginx/conf.d/csp.inc
