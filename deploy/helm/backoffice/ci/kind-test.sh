#!/bin/sh
# Feature 019 (T091, FR-049, FR-053, FR-076, SC-003, US7 scenario 3): the chart on a kind cluster next to a Directus
# deployment (ci/deps.yaml); spec 026 (US2, US3 scenario 1): Backoffice on its own host backoffice.test, Directus keeps
# cms.test (no Ingress here, reached by port-forward) and never joins the pool; spec 021 (US6): then the standalone mode
# in namespace bo-standalone (ci/deps-standalone.yaml). The current kubectl context must be the kind cluster $KIND_CLUSTER, and the images
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
api() { curl -s -H 'Host: backoffice.test' "$@"; } # the Backoffice domain (spec 026)

kind load docker-image --name "$cluster" hiennd23/backoffice-api:ci hiennd23/backoffice-web:ci

helm repo add traefik https://traefik.github.io/charts >/dev/null
# ClusterIP: a LoadBalancer Service never gets an address on kind, and the script reaches Traefik through port-forward.
# Idle keep-alive connections to the pods close after 4 s, before Node's 5 s keepAliveTimeout (Directus and Backoffice
# keep the default): a request sent on a connection the pod is closing came back 502 (1 in 9866, CI 39837394576).
helm upgrade --install traefik traefik/traefik --version "$traefik_version" --namespace traefik --create-namespace \
	--set service.type=ClusterIP --set 'additionalArguments={--serverstransport.forwardingtimeouts.idleconntimeout=4s}' --wait
kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/$metrics_version/components.yaml"
kubectl -n kube-system patch deployment metrics-server --type=json \
	-p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Spec 020: one fixture extension, uploaded to extensions/ of the shared storage by the minio-init job.
fixture=$chart/../../../tests/fixtures/extensions/parity-endpoint-demo
kubectl create configmap extension-fixture --from-file=package.json="$fixture/package.json" \
	--from-file=index.js="$fixture/dist/index.js" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$chart/ci/deps.yaml"
kubectl wait --for=condition=complete job/minio-init --timeout=300s
kubectl rollout status deployment/directus --timeout=600s

gen_before=$(kubectl get deployment directus -o jsonpath='{.metadata.generation}')
helm install bo "$chart" -f "$chart/ci/values-kind.yaml" --wait --timeout 10m
kubectl -n traefik port-forward svc/traefik "$port:80" >/dev/null 2>&1 &
pf=$!
trap 'kill $pf 2>/dev/null || true' EXIT
sleep 3
base=http://127.0.0.1:$port

# Routing (spec 026 FR-002): /admin to the FE, the rest to the BE pods, on the Backoffice host.
if api "$base/admin/" | grep -q '<div id="app"'; then ok "Ingress /admin -> web"; else fail "Ingress /admin -> web"; fi
if [ "$(api "$base/server/ping")" = pong ]; then ok "Ingress /server/ping -> api"; else fail "Ingress /server/ping -> api"; fi

# Spec 026 (FR-004, SC-004): the chart never touches the Directus Deployment.
if [ "$(kubectl get deployment directus -o jsonpath='{.metadata.generation}')" = "$gen_before" ]; then
	ok "Directus Deployment unchanged by the install"
else
	fail "Directus Deployment unchanged by the install"
fi

# Spec 026 (US2 scenario 3): a Directus pod still carrying the pool label of 019 gets no request, the Service selects
# the BE pods of the release only. Strategic merge (the default): the label is added, the containers stay.
kubectl patch deployment directus -p '{"spec":{"template":{"metadata":{"labels":{"backoffice.io/api-pool":"bo"}}}}}'
kubectl rollout status deployment/directus --timeout=600s
directus_ip=$(kubectl get pods -l app=directus -o jsonpath='{.items[0].status.podIP}')
endpoints=$(kubectl get endpoints bo-api -o jsonpath='{.subsets[0].addresses[*].ip}')
if [ "$(printf '%s\n' $endpoints | wc -w)" -ge 2 ] && [ -n "$directus_ip" ] && ! printf '%s\n' $endpoints | grep -qx "$directus_ip"; then
	ok "Service bo-api has the BE pods only, not the labelled Directus pod"
else
	fail "Service bo-api has the BE pods only, not the labelled Directus pod ($endpoints; directus $directus_ip)"
fi

# Load through the Ingress while the BE rolls and the HPA changes the replica count (SC-003).
password=$(kubectl get secret directus-secret -o jsonpath='{.data.ADMIN_PASSWORD}' | base64 -d)
token=$(api -X POST "$base/auth/login" -H 'content-type: application/json' \
	-d "{\"email\":\"admin@example.com\",\"password\":\"$password\"}" | node -e 'process.stdin.on("data",(d)=>process.stdout.write(JSON.parse(d).data.access_token))')
# Spec 026 (US2 scenario 2, FR-009): the paths of 020 and 025 reach the BE pods through the one Service.
for path in /permissions/me '/backoffice/permissions?limit=1' /extensions/sources/index.js; do
	code=$(api -o /dev/null -w '%{http_code}' "$base$path" -H "authorization: Bearer $token")
	if [ "$code" = 200 ]; then ok "Ingress $path -> api"; else fail "Ingress $path -> api ($code)"; fi
done
collection=bo_kind_load
api -X POST "$base/collections" -H "authorization: Bearer $token" -H 'content-type: application/json' \
	-d "{\"collection\":\"$collection\",\"schema\":{},\"meta\":{},\"fields\":[{\"field\":\"id\",\"type\":\"integer\",\"schema\":{\"is_primary_key\":true,\"has_auto_increment\":true}},{\"field\":\"title\",\"type\":\"string\"}]}" >/dev/null
node "$chart/ci/load.mjs" "$base" backoffice.test "$token" "$collection" 70 >/tmp/bo-kind-load.json &
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

# Spec 020 (US2, SC-003, FR-045, FR-040): every node (the BE pods through the Ingress, Directus directly: spec 026 keeps
# it out of the pool) serves the endpoint extension from the shared storage; disabled through the Directus pod it
# answers 404 everywhere within 10 s, enabled again 200, and pods added by the HPA have it before they are ready.
demo() { # demo <expected status>: 12 calls through the Ingress (spread over the BE pods) answer <status>
	for _ in $(seq 12); do [ "$(api -o /dev/null -w '%{http_code}' "$base/parity-endpoint-demo")" = "$1" ] || return 1; done
}
demo_directus() { [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18055/parity-endpoint-demo)" = "$1" ]; }
until_demo() { for _ in $(seq 20); do demo "$1" && demo_directus "$1" && return 0; sleep 0.5; done; return 1; }
ext_id=$(api "$base/extensions" -H "authorization: Bearer $token" | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data.find((e)=>e.meta.folder==="parity-endpoint-demo").id))')
kubectl port-forward deployment/directus 18055:8055 >/dev/null 2>&1 &
pfd=$!
sleep 3
toggle() { curl -s -o /dev/null -X PATCH "http://127.0.0.1:18055/extensions/$ext_id" -H "authorization: Bearer $token" \
	-H 'content-type: application/json' -d "{\"meta\":{\"enabled\":$1}}"; }
if demo 200 && demo_directus 200; then ok "020: endpoint extension on every node"; else fail "020: endpoint extension on every node"; fi
toggle false
if until_demo 404; then ok "020: disabled at Directus -> 404 on every pod within 10 s"; else fail "020: disabled -> 404 everywhere"; fi
toggle true
if until_demo 200; then ok "020: enabled again -> 200 on every pod"; else fail "020: enabled again -> 200 everywhere"; fi
kill $pfd 2>/dev/null || true
kubectl patch hpa bo-api --type=merge -p '{"spec":{"minReplicas":4}}'
kubectl rollout status deployment/bo-api --timeout=300s
if demo 200; then ok "020: pods added by the HPA serve the extension"; else fail "020: pods added by the HPA serve the extension"; fi
kubectl patch hpa bo-api --type=merge -p '{"spec":{"minReplicas":2}}'

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
	--set domain.publicUrl=http://bo2.test --set ingress.host=bo2.test 2>&1); then
	fail "FR-076: install with a foreign cookie domain is stopped"
	helm uninstall bo2 >/dev/null
elif echo "$out" | grep -q 'REFRESH_TOKEN_COOKIE_DOMAIN="cms.test"' && echo "$out" | grep -q 'bo2.test'; then
	ok "FR-076: install with a foreign cookie domain is stopped"
else
	fail "FR-076: message names the variable and the host: $out"
fi

# FR-053: a config only safe for one instance stops the install with every reason.
kubectl get configmap directus-config -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const c=JSON.parse(s);c.metadata={name:"directus-config-single"};delete c.data.SYNCHRONIZATION_STORE;c.data.CACHE_STORE="memory";c.data.STORAGE_LOCATIONS="local";delete c.data.STORAGE_LOCAL_DRIVER;process.stdout.write(JSON.stringify(c))})' | kubectl apply -f - >/dev/null
kubectl get secret directus-secret -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const c=JSON.parse(s);c.metadata={name:"directus-secret-nosecret"};delete c.data.SECRET;process.stdout.write(JSON.stringify(c))})' | kubectl apply -f - >/dev/null
if out=$(helm install bo3 "$chart" -f "$chart/ci/values-kind.yaml" --set directus.configMap=directus-config-single \
	--set directus.secret=directus-secret-nosecret --set ingress.host=bo3.test --set domain.publicUrl=http://bo3.test 2>&1); then
	fail "FR-053: install with a single-instance config is stopped"
	helm uninstall bo3 >/dev/null
else
	missing=""
	for reason in SYNCHRONIZATION_STORE CACHE_STORE 'SECRET is not set' 'storage location "local"'; do
		echo "$out" | grep -q "$reason" || missing="$missing $reason"
	done
	if [ -z "$missing" ]; then ok "FR-053: install stopped, every reason named"; else fail "FR-053: missing reasons:$missing"; fi
fi

# Spec 026 (US3 scenario 1, SC-006): an upgrade without the Backoffice domain (the values of a 019 shared-domain
# release) stops before any resource changes.
gen_api=$(kubectl get deployment bo-api -o jsonpath='{.metadata.generation}')
if out=$(helm upgrade bo "$chart" -f "$chart/ci/values-kind.yaml" --set domain.publicUrl= --set ingress.host=cms.test 2>&1); then
	fail "US3-1: upgrade without the Backoffice domain is stopped"
elif echo "$out" | grep -q 'domain.publicUrl' && [ "$(kubectl get deployment bo-api -o jsonpath='{.metadata.generation}')" = "$gen_api" ]; then
	ok "US3-1: upgrade without the Backoffice domain is stopped, nothing changed"
else
	fail "US3-1: message or generation: $out"
fi

helm uninstall bo >/dev/null

# Spec 021, US6 (FR-080..FR-085, SC-006): the standalone mode in its own namespace, without Directus. Steps of
# specs/021-standalone-init-cli/contracts/tests.md "kind".
ns=bo-standalone
fixtures=$chart/../../../tests/parity/fixtures/migrations
sa() { curl -s -H 'Host: bo.test' "$@"; }
sql() { kubectl -n "$1" exec deploy/postgres -- psql -U backoffice -d backoffice -Atc "$2"; }
migrations() { # migrations <file...>: the migrations ConfigMap of $ns holds exactly these files
	args=""
	for f in "$@"; do args="$args --from-file=$f"; done
	kubectl -n "$ns" create configmap migrations $args --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}
kubectl create namespace "$ns"
kubectl -n "$ns" apply -f "$chart/ci/deps-standalone.yaml"
kubectl -n "$ns" wait --for=condition=complete job/minio-init --timeout=300s
kubectl -n "$ns" rollout status deployment/postgres --timeout=300s
migrations "$fixtures/ok/20990101A-create-sample.js"

if helm install bo-sa "$chart" -n "$ns" -f "$chart/ci/values-kind-standalone.yaml" --wait --timeout 10m; then
	ok "standalone: install on an empty database"
else
	fail "standalone: install on an empty database"
	kubectl -n "$ns" logs job/bo-sa-bootstrap || true
fi
done_at=$(kubectl -n "$ns" get job bo-sa-bootstrap -o jsonpath='{.status.completionTime}')
first_pod=$(kubectl -n "$ns" get pods -l app.kubernetes.io/component=api -o jsonpath='{.items[*].metadata.creationTimestamp}' | tr ' ' '\n' | sort | head -1)
if [ -n "$done_at" ] && [ -n "$first_pod" ] && [ "$done_at" \< "$first_pod" -o "$done_at" = "$first_pod" ]; then
	ok "standalone: Job Complete ($done_at) before the first api pod ($first_pod)"
else
	fail "standalone: Job Complete ($done_at) before the first api pod ($first_pod)"
fi
if [ "$(sql "$ns" 'select count(*) from directus_migrations')" = 102 ]; then
	ok "standalone: 101 system migrations + 1 custom"
else
	fail "standalone: directus_migrations = $(sql "$ns" 'select count(*) from directus_migrations')"
fi
sa_password=$(kubectl -n "$ns" get secret backoffice-secret -o jsonpath='{.data.ADMIN_PASSWORD}' | base64 -d)
# Traefik picks the new Ingress up a moment after `helm install --wait` (CI 39722312362: login 0.1 s later got no token).
sa_token=""
for _ in $(seq 60); do
	sa_token=$(sa -X POST "$base/auth/login" -H 'content-type: application/json' \
		-d "{\"email\":\"admin@example.com\",\"password\":\"$sa_password\"}" | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).data.access_token)}catch{}})')
	[ -n "$sa_token" ] && break
	sleep 1
done
if [ -n "$sa_token" ]; then ok "standalone: admin signs in through the Ingress"; else fail "standalone: admin signs in through the Ingress"; fi
if [ "$(kubectl -n "$ns" get deployment bo-sa-api -o jsonpath='{.spec.template.spec.containers[0].args}')" = '["node","cli.js","start"]' ]; then
	ok "standalone: the pods only run start"
else
	fail "standalone: the pods only run start"
fi

# A new custom migration through helm upgrade, under load: the Job runs it once; no request fails.
sa_collection=bo_kind_sa_load
sa -X POST "$base/collections" -H "authorization: Bearer $sa_token" -H 'content-type: application/json' \
	-d "{\"collection\":\"$sa_collection\",\"schema\":{},\"meta\":{},\"fields\":[{\"field\":\"id\",\"type\":\"integer\",\"schema\":{\"is_primary_key\":true,\"has_auto_increment\":true}},{\"field\":\"title\",\"type\":\"string\"}]}" >/dev/null
old_job=$(kubectl -n "$ns" get job bo-sa-bootstrap -o jsonpath='{.metadata.uid}')
migrations "$fixtures/ok/20990101A-create-sample.js" "$fixtures/ok/20990102A-add-column-default.js"
node "$chart/ci/load.mjs" "$base" bo.test "$sa_token" "$sa_collection" 60 >/tmp/bo-kind-sa-load.json &
load=$!
sleep 5
if helm upgrade bo-sa "$chart" -n "$ns" -f "$chart/ci/values-kind-standalone.yaml" --wait --timeout 10m; then
	ok "standalone: upgrade with a new migration"
else
	fail "standalone: upgrade with a new migration"
fi
wait $load
cat /tmp/bo-kind-sa-load.json
if node -e 'const r=require("/tmp/bo-kind-sa-load.json"); process.exit(r.errors===0 && r.timeouts===0 && r.non2xx===0 && r.requests>=5000 ? 0 : 1)'; then
	ok "standalone: upgrade under load (>= 5000 requests): no failed request"
else
	fail "standalone: upgrade under load (>= 5000 requests): no failed request"
fi
if [ "$(sql "$ns" 'select count(*) from directus_migrations')" = 103 ]; then ok "standalone: the new migration ran once"; else fail "standalone: directus_migrations = $(sql "$ns" 'select count(*) from directus_migrations')"; fi
if [ "$(kubectl -n "$ns" get job bo-sa-bootstrap -o jsonpath='{.metadata.uid}')" != "$old_job" ]; then
	ok "standalone: a new Job replaced the old one"
else
	fail "standalone: a new Job replaced the old one"
fi

# A migration that throws: the upgrade fails, the release and the pods stay as they were, the Job keeps its log.
revision=$(helm history bo-sa -n "$ns" -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).filter((r)=>r.status==="deployed").at(-1).revision)))')
pods=$(kubectl -n "$ns" get pods -l app.kubernetes.io/component=api -o jsonpath='{.items[*].metadata.name}')
migrations "$fixtures/ok/20990101A-create-sample.js" "$fixtures/ok/20990102A-add-column-default.js" "$fixtures/fail/20990106A-throws.js"
if helm upgrade bo-sa "$chart" -n "$ns" -f "$chart/ci/values-kind-standalone.yaml" --set bootstrap.backoffLimit=0 --wait --timeout 5m; then
	fail "standalone: an upgrade whose migration throws fails"
else
	ok "standalone: an upgrade whose migration throws fails"
fi
deployed=$(helm history bo-sa -n "$ns" -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).filter((r)=>r.status==="deployed").at(-1).revision)))')
if [ "$deployed" = "$revision" ] && [ "$(kubectl -n "$ns" get pods -l app.kubernetes.io/component=api -o jsonpath='{.items[*].metadata.name}')" = "$pods" ]; then
	ok "standalone: release revision $revision and its pods kept"
else
	fail "standalone: release revision $revision and its pods kept (now $deployed)"
fi
if kubectl -n "$ns" logs job/bo-sa-bootstrap 2>/dev/null | grep -q '20990106A fails on purpose'; then
	ok "standalone: the failed Job keeps its log"
else
	fail "standalone: the failed Job keeps its log"
fi
if [ "$(sa "$base/server/ping")" = pong ]; then ok "standalone: still serving"; else fail "standalone: still serving"; fi
helm uninstall bo-sa -n "$ns" >/dev/null

# A first install that fails (database unreachable): release failed, no Deployment, the Job log kept, uninstall works.
nsf=bo-standalone-fail
kubectl create namespace "$nsf"
kubectl -n "$nsf" apply -f "$chart/ci/deps-standalone.yaml" >/dev/null
kubectl -n "$nsf" patch configmap backoffice-config --type=merge -p '{"data":{"DB_HOST":"no-such-postgres"}}'
kubectl -n "$nsf" create configmap migrations --from-file="$fixtures/ok/20990101A-create-sample.js"
if helm install bo-sf "$chart" -n "$nsf" -f "$chart/ci/values-kind-standalone.yaml" --set ingress.host=bo-fail.test \
	--set bootstrap.backoffLimit=0 --wait --timeout 3m; then
	fail "standalone: install on an unreachable database fails"
else
	ok "standalone: install on an unreachable database fails"
fi
if [ "$(helm status bo-sf -n "$nsf" -o json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).info.status))')" = failed ] \
	&& ! kubectl -n "$nsf" get deployment bo-sf-api >/dev/null 2>&1 \
	&& kubectl -n "$nsf" logs job/bo-sf-bootstrap 2>/dev/null | grep -q .; then
	ok "standalone: failed release, no Deployment, the Job log kept"
else
	fail "standalone: failed release, no Deployment, the Job log kept"
fi
if helm uninstall bo-sf -n "$nsf" >/dev/null; then ok "standalone: uninstall of the failed release"; else fail "standalone: uninstall of the failed release"; fi

[ "$fails" -eq 0 ] || { echo "$fails check(s) failed"; exit 1; }
echo "all kind checks passed"
