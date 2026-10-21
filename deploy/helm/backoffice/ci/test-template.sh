#!/bin/sh
# Feature 019 (T090, FR-045..FR-049, FR-053, FR-071): lint the chart, render it with several values and check the
# manifests against the Kubernetes 1.29 schemas, then check what the spec asks of them. Runs locally and in CI.
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

base="--set directus.configMap=cm --set directus.secret=sec --set ingress.host=h.test"
$helm lint "$chart" $base
$helm template bo "$chart" $base >"$out/default.yaml"
$helm template bo "$chart" -f "$chart/values-separate-domain.yaml" --set directus.configMap=cm --set directus.secret=sec >"$out/separate.yaml"
$helm template bo "$chart" $base --set uploads.existingClaim=pvc --set api.autoscaling.enabled=false \
	--set 'ingress.extraPaths[0].path=/auth/login/saml' --set 'ingress.extraPaths[0].service=directus' \
	--set 'ingress.extraPaths[0].port=8055' >"$out/options.yaml"
for f in default separate options; do
	$kubeconform -strict -summary -kubernetes-version 1.29.0 - <"$out/$f.yaml"
done

d=$out/default.yaml
check "no Directus variable declared (shared domain)" test "$(count "$d" 'name: PUBLIC_URL')" -eq 0
check "no cookie domain variable in any rendering" test "$(cat "$out"/*.yaml | grep -c COOKIE_DOMAIN || true)" -eq 0
check "api envFrom ConfigMap and Secret" grep -q 'secretRef: { name: sec }' "$d"
check "web envFrom the ConfigMap only" test "$(count "$d" 'configMapRef: { name: cm }')" -eq 2
check "secretRef only once (api)" test "$(count "$d" 'secretRef:')" -eq 1
check "api Service selects the pool label only" grep -A2 '^  selector:$' "$d"
check "pool label on the api pods" grep -q 'backoffice.io/api-pool: bo' "$d"
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
check "Ingress: /extensions/sources to api-only, before /admin" sh -c "grep -q 'name: bo-api-only, port: { number: 8055 }' '$d' && awk '/path: \\/extensions\\/sources/{e=NR} /path: \\/admin/{a=NR} END{exit !(e && a && e<a)}' '$d'"
check "api-only Service selects the api pods, not the pool" sh -c "awk '/name: bo-api-only/{f=1} f&&/selector:/{s=1} s&&/app.kubernetes.io\\/component: api/{ok=1} END{exit !ok}' '$d' && ! awk '/name: bo-api-only/{f=1} f&&/backoffice.io\\/api-pool/{exit 0} END{exit 1}' '$d'"

s=$out/separate.yaml
check "separate domain: PUBLIC_URL on api and web only" test "$(count "$s" 'name: PUBLIC_URL')" -eq 2
check "separate domain: the Backoffice URL" grep -q 'value: "https://backoffice.example.com"' "$s"
check "separate domain: no other env entry" test "$(grep -cE '\{ name: [A-Z0-9_]+, value: ' "$s" || true)" -eq 2
check "separate domain: own pool label" grep -q 'backoffice.io/api-pool: backoffice-separate' "$s"

o=$out/options.yaml
check "existing PVC mounted at /directus/uploads" sh -c "grep -q 'claimName: pvc' '$o' && grep -q 'mountPath: /directus/uploads' '$o'"
check "fixed replicas when autoscaling is off" sh -c "grep -q 'replicas: 2' '$o' && ! grep -q HorizontalPodAutoscaler '$o'"
check "extra path before /" sh -c "awk '/path: \\/auth\\/login\\/saml/{s=NR} /path: \\/\$/{r=NR} END{exit !(s && r && s<r)}' '$o'"

# FR-053, FR-076 without a cluster: a copy of the chart reads the ConfigMap and Secret from values instead of lookup.
fake=$out/chart
cp -R "$chart" "$fake"
sed -i.bak \
	-e 's#lookup "v1" "ConfigMap" .Release.Namespace .Values.directus.configMap#.Values.fakeLookup.configMap#' \
	-e 's#lookup "v1" "Secret" .Release.Namespace .Values.directus.secret#.Values.fakeLookup.secret#' \
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
desc="FR-076: shared domain ignores cookie domains" expect_ok --set-string fakeLookup.configMap.data.REFRESH_TOKEN_COOKIE_DOMAIN=cms.example.com

if $helm template bo "$chart" --set directus.secret=sec --set ingress.host=h.test >/dev/null 2>&1; then
	echo "FAIL directus.configMap is required"; fails=$((fails + 1))
else
	echo "ok   directus.configMap is required"
fi

[ "$fails" -eq 0 ] || { echo "$fails check(s) failed"; exit 1; }
echo "all template checks passed"
