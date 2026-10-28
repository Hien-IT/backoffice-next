#!/bin/sh
# Feature 019 (T090, FR-045..FR-049, FR-053, FR-071), spec 026 (FR-003, FR-006..FR-010): lint the chart, render it with
# several values and check the manifests against the Kubernetes 1.29 schemas, then check what the spec asks of them.
# Runs locally and in CI.
#   HELM, KUBECONFORM: commands to use (default: the binaries on PATH).
set -eu
chart=$(cd "$(dirname "$0")/.." && pwd)
helm=${HELM:-helm}
kubeconform=${KUBECONFORM:-kubeconform}
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
fails=0

check() { # check <description> <command...>
	desc=$1
	shift
	if "$@" >/dev/null 2>&1; then echo "ok   $desc"; else echo "FAIL $desc"; fails=$((fails + 1)); fi
}
count() { grep -c -- "$2" "$1" || true; }

# Spec 026: next to Directus the Backoffice domain (ingress.host, domain.publicUrl) is required.
base="--set directus.configMap=cm --set directus.secret=sec --set ingress.host=h.test --set domain.publicUrl=https://h.test"
$helm lint "$chart" $base
$helm template bo "$chart" $base >"$out/default.yaml"
$helm template bo "$chart" $base --set uploads.existingClaim=pvc --set api.autoscaling.enabled=false \
	--set 'ingress.extraPaths[0].path=/hook' --set 'ingress.extraPaths[0].service=other' \
	--set 'ingress.extraPaths[0].port=80' >"$out/options.yaml"
# Spec 021 (FR-080..FR-085): the standalone mode with a migrations ConfigMap (no Backoffice domain value).
$helm template bo "$chart" --set directus.configMap=cm --set directus.secret=sec --set ingress.host=h.test \
	--set mode=standalone --set migrations.configMap=mig >"$out/standalone.yaml"
for f in default options standalone; do
	$kubeconform -strict -summary -kubernetes-version 1.29.0 - <"$out/$f.yaml"
done

d=$out/default.yaml
# Spec 026 (FR-003, SC-004): PUBLIC_URL of the Backoffice domain on the api and web pods, nothing else.
check "shared: PUBLIC_URL on api and web only" test "$(count "$d" 'name: PUBLIC_URL')" -eq 2
check "shared: the Backoffice URL" grep -q 'value: "https://h.test"' "$d"
check "shared: no other env entry" test "$(grep -cE '\{ name: [A-Z0-9_]+, value: ' "$d" || true)" -eq 2
check "no cookie domain variable in any rendering" test "$(cat "$out"/*.yaml | grep -c COOKIE_DOMAIN || true)" -eq 0
check "api envFrom ConfigMap and Secret" grep -q 'secretRef: { name: sec }' "$d"
check "web envFrom the ConfigMap only" test "$(count "$d" 'configMapRef: { name: cm }')" -eq 2
check "secretRef only once (api)" test "$(count "$d" 'secretRef:')" -eq 1
# Spec 026 (FR-006): the BE pods of the release only; no pool label, no api-only Service.
check "api Service selects the release pods" sh -c "awk '/name: bo-api\$/{f=1} f&&/selector:/{s=1} s&&/app.kubernetes.io\\/component: api/{ok=1} s&&/ports:/{exit} END{exit !ok}' '$d'"
check "no pool label, no api-only Service" sh -c "! grep -q api-pool '$d' && ! grep -q bo-api-only '$d'"
check "readiness /server/health" grep -q 'path: /server/health' "$d"
check "liveness and startup /server/ping" test "$(count "$d" 'path: /server/ping')" -eq 2
check "preStop sleep 10" grep -q 'command: \["sleep", "10"\]' "$d"
check "grace period 30" grep -q 'terminationGracePeriodSeconds: 30' "$d"
check "rolling update without unavailable pods" grep -q 'maxUnavailable: 0' "$d"
check "HPA autoscaling/v2" grep -q 'apiVersion: autoscaling/v2' "$d"
check "runAsNonRoot on both pods" test "$(count "$d" 'runAsNonRoot: true')" -eq 2
check "api runs as 1000, web as 1001" sh -c "grep -q 'runAsUser: 1000' '$d' && grep -q 'runAsUser: 1001' '$d'"
check "no privilege escalation (both)" test "$(count "$d" 'allowPrivilegeEscalation: false')" -eq 2
check "all capabilities dropped (both)" test "$(count "$d" 'drop: \[ALL\]')" -eq 2
check "Ingress: /admin to web, / to api" sh -c "grep -q 'name: bo-web, port: { number: 8080 }' '$d' && grep -q 'name: bo-api, port: { number: 8055 }' '$d'"
# Spec 026 (FR-007, FR-009): one host, no other path (the 020/025 routes are gone).
check "Ingress: no other path" test "$(grep -cE '^ +- path: /' "$d" || true)" -eq 2
check "shared without domain.publicUrl stops" sh -c "! $helm template bo '$chart' --set directus.configMap=cm --set directus.secret=sec --set ingress.host=h.test >/dev/null 2>&1 && $helm template bo '$chart' --set directus.configMap=cm --set directus.secret=sec --set ingress.host=h.test 2>&1 | grep -q 'domain.publicUrl'"

o=$out/options.yaml
check "existing PVC mounted at /backoffice/uploads" sh -c "grep -q 'claimName: pvc' '$o' && grep -q 'mountPath: /backoffice/uploads' '$o'"
check "fixed replicas when autoscaling is off" sh -c "grep -q 'replicas: 2' '$o' && ! grep -q HorizontalPodAutoscaler '$o'"
check "extra path before /" sh -c "awk '/path: \\/hook/{s=NR} /path: \\/\$/{r=NR} END{exit !(s && r && s<r)}' '$o'"

t=$out/standalone.yaml
check "standalone: no PUBLIC_URL (021 FR-083)" test "$(count "$t" 'name: PUBLIC_URL')" -eq 0
check "shared: no Job, no args (image CMD)" sh -c "! grep -q 'kind: Job' '$d' && ! grep -q 'args:' '$d'"
check "standalone: one hook Job, pre-install and pre-upgrade" sh -c "test \"\$(grep -c 'helm.sh/hook:' '$t')\" -eq 1 && grep -q 'helm.sh/hook: pre-install,pre-upgrade' '$t'"
check "standalone: Job weight, delete policy, one pod at a time" sh -c "grep -q 'helm.sh/hook-weight: \"10\"' '$t' && grep -q 'hook-delete-policy: before-hook-creation' '$t' && grep -q 'parallelism: 1' '$t' && grep -q 'completions: 1' '$t'"
check "standalone: Job backoffLimit, deadline, restartPolicy Never" sh -c "grep -q 'backoffLimit: 3' '$t' && grep -q 'activeDeadlineSeconds: 600' '$t' && grep -q 'restartPolicy: Never' '$t'"
check "standalone: the Job bootstraps, the pods only start" sh -c "grep -q 'args: \\[\"node\", \"cli.js\", \"bootstrap\"\\]' '$t' && grep -q 'args: \\[\"node\", \"cli.js\", \"start\"\\]' '$t'"
check "standalone: secretRef on api and Job" test "$(count "$t" 'secretRef:')" -eq 2
check "standalone: runAsNonRoot on api, web, Job" test "$(count "$t" 'runAsNonRoot: true')" -eq 3
check "standalone: no privilege escalation on api, web, Job" test "$(count "$t" 'allowPrivilegeEscalation: false')" -eq 3
check "standalone: migrations ConfigMap on api and Job" sh -c "test \"\$(grep -c 'configMap: { name: mig }' '$t')\" -eq 2 && test \"\$(grep -c 'mountPath: /backoffice/migrations' '$t')\" -eq 2"
check "shared: migrations ConfigMap mounted too" sh -c "$helm template bo '$chart' $base --set migrations.configMap=mig | grep -q 'mountPath: /backoffice/migrations'"
check "mode must be shared or standalone" sh -c "! $helm template bo '$chart' $base --set mode=other"
notes_has() { # notes_has <text> <helm args...>: the NOTES of a client dry run hold the text
	text=$1
	shift
	$helm install bo "$chart" --dry-run=client $base "$@" | sed -n '/^NOTES:/,$p' | grep -qF -- "$text"
}
check "NOTES shared: Directus bootstraps the database first" notes_has "must be bootstrapped by Directus"
check "NOTES shared: own domain (spec 026)" notes_has "Directus keeps its own domain"
check "NOTES standalone: no Backoffice domain" sh -c "! $helm install bo '$chart' --dry-run=client $base --set mode=standalone | sed -n '/^NOTES:/,\$p' | grep -q PUBLIC_URL"
check "NOTES standalone with migrations: helm upgrade right away" notes_has "run helm upgrade right away" --set mode=standalone --set migrations.configMap=mig

# FR-053, FR-076 without a cluster: a copy of the chart reads the ConfigMap and Secret from values instead of lookup.
fake=$out/chart
cp -R "$chart" "$fake"
sed -i.bak \
	-e 's#lookup "v1" "ConfigMap" .Release.Namespace .Values.directus.configMap#(ternary (dict) .Values.fakeLookup.configMap (.Values.fakeLookup.noConfigMap | default false))#' \
	-e 's#lookup "v1" "Secret" .Release.Namespace .Values.directus.secret#(ternary (dict) .Values.fakeLookup.secret (.Values.fakeLookup.noSecret | default false))#' \
	-e 's#lookup "v1" "Namespace" "" .Release.Namespace#.Values.fakeLookup.namespace#' \
	"$fake/templates/_checks.tpl"
good="--set-string fakeLookup.configMap.data.CACHE_STORE=redis
--set-string fakeLookup.configMap.data.RATE_LIMITER_STORE=redis --set-string fakeLookup.configMap.data.SYNCHRONIZATION_STORE=redis
--set-string fakeLookup.configMap.data.DB_CLIENT=pg --set-string fakeLookup.configMap.data.STORAGE_LOCATIONS=s3
--set-string fakeLookup.configMap.data.STORAGE_S3_DRIVER=s3 --set-string fakeLookup.configMap.data.EXTENSIONS_LOCATION=s3
--set-string fakeLookup.secret.data.SECRET=$(printf s | base64)"
redis="--set-string fakeLookup.configMap.data.REDIS=redis://r"
render() { $helm template bo "$fake" $base $good ${NO_REDIS:-$redis} "$@" 2>&1; }
expect_ok() { if render "$@" >/dev/null; then echo "ok   $desc"; else echo "FAIL $desc: $(render "$@" | tail -3)"; fails=$((fails + 1)); fi; }
expect_fail() { # expect_fail <text the message must hold> <helm args...>
	text=$1
	shift
	if msg=$(render "$@"); then echo "FAIL $desc (installed)"; fails=$((fails + 1));
	elif echo "$msg" | grep -qF -- "$text"; then echo "ok   $desc"; else echo "FAIL $desc: $msg"; fails=$((fails + 1)); fi
}
desc="FR-053: a multi-instance config passes" expect_ok
# An empty REDIS is still "REDIS in env" for Directus: the case leaves the key out.
NO_REDIS=" "
desc="FR-053: no Redis" expect_fail "No Redis configured"
unset NO_REDIS
desc="FR-053: REDIS_ENABLED=false wins over REDIS" expect_fail "No Redis configured" --set-string fakeLookup.configMap.data.REDIS_ENABLED=false
desc="FR-053: CACHE_STORE memory" expect_fail 'CACHE_STORE is "memory"' --set-string fakeLookup.configMap.data.CACHE_STORE=memory
desc="FR-053: RATE_LIMITER_STORE unset = memory" expect_fail 'RATE_LIMITER_STORE is "memory"' --set-string fakeLookup.configMap.data.RATE_LIMITER_STORE=
desc="FR-053: SYNCHRONIZATION_STORE unset" expect_fail "SYNCHRONIZATION_STORE is not" --set-string fakeLookup.configMap.data.SYNCHRONIZATION_STORE=
desc="FR-053: no SECRET" expect_fail "SECRET is not set" --set-string fakeLookup.secret.data.SECRET=
desc="FR-053: sqlite" expect_fail 'DB_CLIENT is "sqlite3"' --set-string fakeLookup.configMap.data.DB_CLIENT=sqlite3
desc="FR-053: local driver without PVC" expect_fail 'storage location "files" uses the local driver' \
	--set-string fakeLookup.configMap.data.STORAGE_LOCATIONS=s3\\,files --set-string fakeLookup.configMap.data.STORAGE_FILES_DRIVER=local
desc="FR-053: local driver with a PVC passes" expect_ok --set-string fakeLookup.configMap.data.STORAGE_LOCATIONS=local --set uploads.existingClaim=pvc
desc="020 FR-045: no EXTENSIONS_LOCATION with HPA stops" expect_fail "EXTENSIONS_LOCATION is empty" \
	--set-string fakeLookup.configMap.data.EXTENSIONS_LOCATION=
desc="020 FR-045: no EXTENSIONS_LOCATION with 2 fixed replicas stops" expect_fail "EXTENSIONS_LOCATION is empty" \
	--set-string fakeLookup.configMap.data.EXTENSIONS_LOCATION= --set api.autoscaling.enabled=false --set api.replicas=2
desc="020 FR-045: one replica without EXTENSIONS_LOCATION passes" expect_ok \
	--set-string fakeLookup.configMap.data.EXTENSIONS_LOCATION= --set api.autoscaling.enabled=false --set api.replicas=1
desc="020 FR-045: extensions.inImage=true passes" expect_ok --set-string fakeLookup.configMap.data.EXTENSIONS_LOCATION= --set extensions.inImage=true
sep="--set domain.publicUrl=https://backoffice.example.com --set ingress.host=backoffice.example.com"
desc="FR-076: foreign cookie domain stops" expect_fail 'REFRESH_TOKEN_COOKIE_DOMAIN="cms.example.com" in ConfigMap cm does not cover the Backoffice host "backoffice.example.com"' \
	$sep --set-string fakeLookup.configMap.data.REFRESH_TOKEN_COOKIE_DOMAIN=cms.example.com
desc="FR-076: parent domain passes" expect_ok $sep --set-string fakeLookup.configMap.data.SESSION_COOKIE_DOMAIN=.example.com
desc="FR-076: secret cookie domain names the Secret" expect_fail "SESSION_COOKIE_DOMAIN=\"other.org\" in Secret sec" \
	$sep --set-string fakeLookup.secret.data.SESSION_COOKIE_DOMAIN=$(printf other.org | base64)
# Spec 026 (FR-008): every install next to Directus, and the host of domain.publicUrl when the Ingress is off.
desc="FR-076 (026): a foreign cookie domain stops every install next to Directus" expect_fail 'REFRESH_TOKEN_COOKIE_DOMAIN="cms.example.com" in ConfigMap cm does not cover the Backoffice host "h.test"' \
	--set-string fakeLookup.configMap.data.REFRESH_TOKEN_COOKIE_DOMAIN=cms.example.com
desc="FR-076 (026): the host of domain.publicUrl when the Ingress is off" expect_fail 'does not cover the Backoffice host "h.test"' \
	--set ingress.enabled=false --set ingress.host= --set-string fakeLookup.configMap.data.REFRESH_TOKEN_COOKIE_DOMAIN=cms.example.com

# Spec 021 (FR-083, FR-085). fakeLookup.namespace stands for a real install (lookup answers only with a cluster).
desc="021 FR-083: standalone without the ConfigMap stops" expect_fail 'ConfigMap "cm" not found in namespace default: create the Backoffice env ConfigMap and Secret' \
	--set mode=standalone --set-string fakeLookup.namespace.kind=Namespace --set fakeLookup.noConfigMap=true
desc="021 FR-083: standalone with both passes" expect_ok --set mode=standalone --set-string fakeLookup.namespace.kind=Namespace
desc="021 FR-083: helm template of standalone (no cluster) passes" expect_ok --set mode=standalone --set fakeLookup.noConfigMap=true \
	--set fakeLookup.noSecret=true
desc="021 FR-083: standalone without the Secret stops" expect_fail 'Secret "sec" not found in namespace default' \
	--set mode=standalone --set-string fakeLookup.namespace.kind=Namespace --set fakeLookup.noSecret=true
desc="021 FR-083: standalone ignores cookie domains" expect_ok --set mode=standalone $sep \
	--set-string fakeLookup.configMap.data.REFRESH_TOKEN_COOKIE_DOMAIN=cms.example.com
desc="021 FR-085: MIGRATIONS_PATH elsewhere stops" expect_fail 'MIGRATIONS_PATH="/data/mig" in ConfigMap cm does not point to /backoffice/migrations' \
	--set migrations.configMap=mig --set-string fakeLookup.configMap.data.MIGRATIONS_PATH=/data/mig
desc="021 FR-085: MIGRATIONS_PATH=./migrations passes" expect_ok --set migrations.configMap=mig --set-string fakeLookup.configMap.data.MIGRATIONS_PATH=./migrations
desc="021 FR-085: MIGRATIONS_PATH elsewhere without the ConfigMap passes" expect_ok --set-string fakeLookup.configMap.data.MIGRATIONS_PATH=/data/mig

if $helm template bo "$chart" --set directus.secret=sec --set ingress.host=h.test --set domain.publicUrl=https://h.test >/dev/null 2>&1; then
	echo "FAIL directus.configMap is required"; fails=$((fails + 1))
else
	echo "ok   directus.configMap is required"
fi

[ "$fails" -eq 0 ] || { echo "$fails check(s) failed"; exit 1; }
echo "all template checks passed"
