#!/bin/sh
# Writes .env (or the file given with --out) from .env.example with random secrets. An existing file is kept.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out="$here/.env"
if [ "${1:-}" = "--out" ]; then out=$2; fi
if [ -e "$out" ]; then
	echo "$out exists, kept"
	exit 0
fi
rand() { openssl rand -hex "$1"; }
umask 077
sed \
	-e "s/^SECRET=$/SECRET=$(rand 32)/" \
	-e "s/^ADMIN_PASSWORD=$/ADMIN_PASSWORD=$(rand 12)/" \
	-e "s/^DB_PASSWORD=$/DB_PASSWORD=$(rand 16)/" \
	-e "s/^STORAGE_S3_KEY=$/STORAGE_S3_KEY=$(rand 10)/" \
	-e "s/^STORAGE_S3_SECRET=$/STORAGE_S3_SECRET=$(rand 20)/" \
	"$here/.env.example" >"$out"
echo "wrote $out"
