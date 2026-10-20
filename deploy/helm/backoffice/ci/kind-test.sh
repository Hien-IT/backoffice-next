#!/bin/sh
# Feature 019 (T091, FR-049, FR-053, FR-076, SC-003, US7 scenario 3): the chart on a kind cluster next to a Directus
# deployment (ci/deps.yaml). The current kubectl context must be the kind cluster $KIND_CLUSTER, and the images
# hiennd23/backoffice-{api,web}:ci must exist locally. Needs kind, kubectl, helm, curl, node (with pnpm install done).
#   TRAEFIK_CHART_VERSION, METRICS_SERVER_VERSION: pinned in research.md "Kết quả T001".
set -eu
chart=$(cd "$(dirname "$0")/.." && pwd)
cluster=${KIND_CLUSTER:-bo-deploy}
traefik_version=${TRAEFIK_CHART_VERSION:-41.6.1}
metrics_version=${METRICS_SERVER_VERSION:-v0.9.0}
port=18080
fails=0
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
ok() { echo "ok   $*"; }
api() { curl -s -H 'Host: cms.test' "$@"; }

kind load docker-image --name "$cluster" hiennd23/backoffice-api:ci hiennd23/backoffice-web:ci

helm repo add traefik https://traefik.github.io/charts >/dev/null
# ClusterIP: a LoadBalancer Service never gets an address on kind, and the script reaches Traefik through port-forward.
helm upgrade --install traefik traefik/traefik --version "$traefik_version" --namespace traefik --create-namespace \
	--set service.type=ClusterIP --wait
kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/$metrics_version/components.yaml"
kubectl -n kube-system patch deployment metrics-server --type=json \
	-p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

kubectl apply -f "$chart/ci/deps.yaml"
kubectl wait --for=condition=complete job/minio-init --timeout=300s
kubectl rollout status deployment/directus --timeout=600s

helm install bo "$chart" -f "$chart/ci/values-kind.yaml" --wait --timeout 10m
kubectl -n traefik port-forward svc/traefik "$port:80" >/dev/null 2>&1 &
pf=$!
trap 'kill $pf 2>/dev/null || true' EXIT
sleep 3
base=http://127.0.0.1:$port

# Routing (FR-050): /admin to the FE, the rest to the API pool.
if api "$base/admin/" | grep -q '<div id="app"'; then ok "Ingress /admin -> web"; else fail "Ingress /admin -> web"; fi
if [ "$(api "$base/server/ping")" = pong ]; then ok "Ingress /server/ping -> api"; else fail "Ingress /server/ping -> api"; fi

# Directus joins the pool with the label (Q1: A): requests reach BE pods and the Directus pod.
kubectl patch deployment directus --type=merge -p '{"spec":{"template":{"metadata":{"labels":{"backoffice.io/api-pool":"bo"}},"spec":{"containers":[{"name":"directus","lifecycle":{"preStop":{"exec":{"command":["sleep","10"]}}}}]}}}}'
kubectl rollout status deployment/directus --timeout=600s
if [ "$(kubectl get endpoints bo-api -o jsonpath='{.subsets[0].addresses[*].ip}' | wc -w)" -ge 3 ]; then
	ok "Service bo-api has the BE pods and Directus"
else
	fail "Service bo-api has the BE pods and Directus"
fi

# Load through the Ingress while the BE rolls and the HPA changes the replica count (SC-003).
password=$(kubectl get secret directus-secret -o jsonpath='{.data.ADMIN_PASSWORD}' | base64 -d)
token=$(api -X POST "$base/auth/login" -H 'content-type: application/json' \
	-d "{\"email\":\"admin@example.com\",\"password\":\"$password\"}" | node -e 'process.stdin.on("data",(d)=>process.stdout.write(JSON.parse(d).data.access_token))')
collection=bo_kind_load
api -X POST "$base/collections" -H "authorization: Bearer $token" -H 'content-type: application/json' \
	-d "{\"collection\":\"$collection\",\"schema\":{},\"meta\":{},\"fields\":[{\"field\":\"id\",\"type\":\"integer\",\"schema\":{\"is_primary_key\":true,\"has_auto_increment\":true}},{\"field\":\"title\",\"type\":\"string\"}]}" >/dev/null
node "$chart/ci/load.mjs" "$base" cms.test "$token" "$collection" 70 >/tmp/bo-kind-load.json &
load=$!
sleep 10
kubectl rollout restart deployment/bo-api
kubectl rollout status deployment/bo-api --timeout=300s
kubectl patch hpa bo-api --type=merge -p '{"spec":{"minReplicas":4}}'
kubectl rollout status deployment/bo-api --timeout=300s
kubectl patch hpa bo-api --type=merge -p '{"spec":{"minReplicas":2}}'
wait $load
cat /tmp/bo-kind-load.json
if node -e 'const r=require("/tmp/bo-kind-load.json"); process.exit(r.errors===0 && r.timeouts===0 && r.non2xx===0 && r.requests>0 ? 0 : 1)'; then
	ok "rolling update and HPA scaling under load: no failed request"
else
	fail "rolling update and HPA scaling under load: no failed request"
fi

# The HPA reads the CPU of the BE pods (metrics-server), with the values of the chart (US7 scenario 3).
cpu=""
for _ in $(seq 60); do
	cpu=$(kubectl get hpa bo-api -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}')
	[ -n "$cpu" ] && break
	sleep 3
done
if [ -n "$cpu" ] && [ "$(kubectl get hpa bo-api -o jsonpath='{.spec.scaleTargetRef.name}')" = bo-api ]; then
	ok "HPA reads CPU ($cpu%) of bo-api"
else
	fail "HPA reads CPU of bo-api"
fi

# FR-076: a cookie domain that does not cover the Backoffice host stops the install with a message naming it.
kubectl get configmap directus-config -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const c=JSON.parse(s);c.metadata={name:"directus-config-cookie"};c.data.REFRESH_TOKEN_COOKIE_DOMAIN="cms.test";process.stdout.write(JSON.stringify(c))})' | kubectl apply -f - >/dev/null
if out=$(helm install bo2 "$chart" -f "$chart/ci/values-kind.yaml" --set directus.configMap=directus-config-cookie \
	--set domain.publicUrl=http://backoffice.test --set ingress.host=backoffice.test --set apiPool.name=bo2 2>&1); then
	fail "FR-076: install with a foreign cookie domain is stopped"
	helm uninstall bo2 >/dev/null
elif echo "$out" | grep -q 'REFRESH_TOKEN_COOKIE_DOMAIN="cms.test"' && echo "$out" | grep -q 'backoffice.test'; then
	ok "FR-076: install with a foreign cookie domain is stopped"
else
	fail "FR-076: message names the variable and the host: $out"
fi

# FR-053: a config only safe for one instance stops the install with every reason.
kubectl get configmap directus-config -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const c=JSON.parse(s);c.metadata={name:"directus-config-single"};delete c.data.SYNCHRONIZATION_STORE;c.data.CACHE_STORE="memory";c.data.STORAGE_LOCATIONS="local";delete c.data.STORAGE_LOCAL_DRIVER;process.stdout.write(JSON.stringify(c))})' | kubectl apply -f - >/dev/null
kubectl get secret directus-secret -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const c=JSON.parse(s);c.metadata={name:"directus-secret-nosecret"};delete c.data.SECRET;process.stdout.write(JSON.stringify(c))})' | kubectl apply -f - >/dev/null
if out=$(helm install bo3 "$chart" -f "$chart/ci/values-kind.yaml" --set directus.configMap=directus-config-single \
	--set directus.secret=directus-secret-nosecret --set ingress.host=bo3.test --set apiPool.name=bo3 2>&1); then
	fail "FR-053: install with a single-instance config is stopped"
	helm uninstall bo3 >/dev/null
else
	missing=""
	for reason in SYNCHRONIZATION_STORE CACHE_STORE 'SECRET is not set' 'storage location "local"'; do
		echo "$out" | grep -q "$reason" || missing="$missing $reason"
	done
	if [ -z "$missing" ]; then ok "FR-053: install stopped, every reason named"; else fail "FR-053: missing reasons:$missing"; fi
fi

helm uninstall bo >/dev/null
[ "$fails" -eq 0 ] || { echo "$fails check(s) failed"; exit 1; }
echo "all kind checks passed"
