#!/usr/bin/env bash
# The gates of .github/workflows/ci.yml on this machine, one after the other (pnpm run ci:local). Without the
# benchmarks (.github/workflows/benchmark.yml): Directus 11.17.4 is amd64-only and runs emulated on arm64, so its numbers
# mean nothing here. Each step logs to .ci-local/<step>.log; the summary lists what failed. Needs Node 22, pnpm, Docker.
# The parity environments of the three vendors use the same ports: they run in turn, and each is taken down after.
set -uo pipefail
cd "$(dirname "$0")/.."

LOG=.ci-local
rm -rf "$LOG" && mkdir -p "$LOG"
results=()
failed=0

step() {
	local name=$1
	shift
	printf '▶ %s\n' "$name"
	local start=$SECONDS

	if "$@" >"$LOG/$name.log" 2>&1; then
		results+=("ok    $name ($((SECONDS - start)) s)")
	else
		results+=("FAIL  $name ($((SECONDS - start)) s): $LOG/$name.log")
		failed=1
	fi
}

quality() {
	pnpm nx run-many -t lint typecheck test build &&
		pnpm run test:tools &&
		pnpm run check-port-headers &&
		pnpm run check-package-names &&
		for f in specs/*/contracts/*.openapi.yaml; do pnpm --filter @backoffice/specs exec swagger-cli validate "$PWD/$f" || return 1; done
}

parity() {
	local vendor=$1 suite=$2 profiles=$3 blackbox=$4
	PARITY_SUITE=$suite pnpm nx run parity-tests:env-up --vendor="$vendor" --profiles="$profiles" &&
		PARITY_SUITE=$suite pnpm nx run parity-tests:parity --vendor="$vendor" --output-style=static &&
		# Feature 005: the reduced blackbox port (key types in $blackbox) after the reduced suite of MySQL and SQLite.
		{ [ -z "$blackbox" ] || PARITY_BLACKBOX_PK_TYPES=$blackbox pnpm nx run parity-tests:parity-blackbox --vendor="$vendor" --output-style=static; }
	local code=$?
	(cd tests/parity && docker compose -p "parity-$vendor" logs --no-color >"../../$LOG/parity-$vendor-containers.log" 2>&1)
	pnpm nx run parity-tests:env-down --vendor="$vendor"
	return $code
}

e2e() {
	docker rm -f api web >/dev/null 2>&1
	pnpm nx run parity-tests:env-up --vendor=postgres &&
		docker run -d --name api --network parity-postgres_default --env-file tests/parity/env/postgres.env \
			-e CORS_ENABLED=true -e CORS_ORIGIN=true -p 8057:8055 hiennd23/backoffice-api:ci &&
		docker run -d --name web -e PUBLIC_URL=http://127.0.0.1:8057 -p 8080:8080 hiennd23/backoffice-web:ci &&
		for _ in $(seq 1 60); do curl -sf http://127.0.0.1:8057/server/ping && break; sleep 2; done &&
		(cd apps/web-e2e && pnpm exec playwright install chromium) &&
		pnpm nx run web-e2e:e2e
	local code=$?
	docker rm -f api web >/dev/null 2>&1
	pnpm nx run parity-tests:env-down --vendor=postgres
	return $code
}

step guard-directus node tools/guard-directus-unchanged.mjs origin/main
step quality quality
step guard-differences pnpm --filter @backoffice/parity-tests exec vitest run src/accepted-differences.test.ts
step security pnpm audit --prod --audit-level=high
step build-api pnpm nx run api:build
# Feature 007: files and assets on `local` and MinIO for Postgres, MinIO only for MySQL and SQLite (PARITY_STORAGES).
PARITY_STORAGES=local,s3 step parity-postgres-full parity postgres full ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,assets-limit,assets-stress
# Feature 006: the nodes of schema-cache.test.ts and of the timezone files are profile pairs.
step parity-blackbox parity postgres blackbox blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america
step parity-cache parity postgres cache cache-mem,cache-mem-purge,cache-redis,cache-redis-purge,websocket
PARITY_STORAGES=s3 step parity-mysql-reduced parity mysql reduced blackbox,assets-limit,assets-stress integer
PARITY_STORAGES=s3 step parity-sqlite3-reduced parity sqlite3 reduced blackbox,assets-limit,assets-stress integer
# One shard of the permission matrix (feature 004); PARITY_MATRIX_SHARD=<i>/4 picks another, unset runs the whole matrix.
step parity-matrix sh -c 'pnpm nx run parity-tests:env-up --vendor=postgres && PARITY_MATRIX_SHARD=${PARITY_MATRIX_SHARD:-1/4} pnpm nx run parity-tests:parity-matrix --vendor=postgres --output-style=static; code=$?; pnpm nx run parity-tests:env-down --vendor=postgres; exit $code'
step docker sh -c 'docker build -f apps/api/Dockerfile -t hiennd23/backoffice-api:ci . && docker build -f apps/web/Dockerfile -t hiennd23/backoffice-web:ci .'
step e2e e2e
# Feature 004: the Directus app through the reverse proxy (profile app).
step e2e-directus-app sh -c 'pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app && BASE_URL=http://127.0.0.1:8160 pnpm nx run directus-app-e2e:e2e --output-style=static; code=$?; pnpm nx run parity-tests:env-down --vendor=postgres; exit $code'

printf '\n'
printf '%s\n' "${results[@]}"
exit $failed
