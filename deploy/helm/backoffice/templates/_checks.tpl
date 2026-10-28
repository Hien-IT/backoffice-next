{{- /*
Feature 019 FR-053, FR-076 (spec 021 FR-083, FR-085 for the standalone mode and the migrations ConfigMap; spec 026
FR-006, FR-008): next to Directus (mode shared) the Backoffice domain is required (checked first, also by `helm template`
and client dry runs); then read the Directus ConfigMap and Secret at install/upgrade (lookup; `helm template` and
client dry runs get nothing back and skip these checks) and stop when the shared config is only safe for one instance, or
when a cookie domain variable does not cover the Backoffice host. The fix belongs in the Directus env: the chart never
overrides these variables. Rules follow how Directus 11.17.4 reads its env
(redis/utils/redis-config-available.ts, packages/env/src/constants/defaults.ts, synchronization.ts).
*/ -}}
{{- define "backoffice.checks" -}}
{{- if not (has .Values.mode (list "shared" "standalone")) -}}
{{- fail (printf "mode is %q: use \"shared\" (next to Directus) or \"standalone\"" .Values.mode) -}}
{{- end -}}
{{- /* Spec 026 (FR-006): next to Directus, Backoffice runs on its own domain; its PUBLIC_URL is required. */ -}}
{{- if and (eq .Values.mode "shared") (not .Values.domain.publicUrl) -}}
{{- fail "domain.publicUrl is empty: next to Directus (mode: shared) Backoffice runs on its own domain. Set domain.publicUrl (https://backoffice.example.com) and ingress.host (backoffice.example.com); upgrading a shared-domain release of 019: see \"Chuyển từ chung domain sang domain riêng\" in deploy/README.md." -}}
{{- end -}}
{{- $cm := lookup "v1" "ConfigMap" .Release.Namespace .Values.directus.configMap -}}
{{- $secret := lookup "v1" "Secret" .Release.Namespace .Values.directus.secret -}}
{{- /* Spec 021 (FR-083): the standalone Job needs the env before it runs; the namespace answers only on a real install. */ -}}
{{- if and (eq .Values.mode "standalone") (lookup "v1" "Namespace" "" .Release.Namespace) -}}
{{- if not $cm -}}
{{- fail (printf "ConfigMap %q not found in namespace %s: create the Backoffice env ConfigMap and Secret before \"helm install\"" .Values.directus.configMap .Release.Namespace) -}}
{{- end -}}
{{- if not $secret -}}
{{- fail (printf "Secret %q not found in namespace %s: create the Backoffice env ConfigMap and Secret before \"helm install\"" .Values.directus.secret .Release.Namespace) -}}
{{- end -}}
{{- end -}}
{{- if or $cm $secret -}}
{{- $env := dict -}}
{{- $from := dict -}}
{{- range $k, $v := (get $cm "data" | default dict) -}}
{{- $_ := set $env $k (toString $v) -}}{{- $_ := set $from $k (printf "ConfigMap %s" $.Values.directus.configMap) -}}
{{- end -}}
{{- range $k, $v := (get $secret "data" | default dict) -}}
{{- $_ := set $env $k (b64dec $v) -}}{{- $_ := set $from $k (printf "Secret %s" $.Values.directus.secret) -}}
{{- end -}}

{{- /* Spec 021 (FR-085): the migrations ConfigMap is mounted where the default MIGRATIONS_PATH points. */ -}}
{{- if .Values.migrations.configMap -}}
{{- $path := get $env "MIGRATIONS_PATH" -}}
{{- if and $path (not (has $path (list "./migrations" "migrations" "/backoffice/migrations"))) -}}
{{- fail (printf "MIGRATIONS_PATH=%q in %s does not point to /backoffice/migrations, where migrations.configMap is mounted: remove the variable or set it to ./migrations, then install again." $path (get $from "MIGRATIONS_PATH")) -}}
{{- end -}}
{{- end -}}

{{- /* Spec 026 (FR-008): on every install/upgrade next to Directus; the host of domain.publicUrl when the Ingress is off.
No Directus domain in the standalone mode (spec 021 FR-083). */ -}}
{{- if ne .Values.mode "standalone" -}}
{{- $host := .Values.ingress.host | default (urlParse .Values.domain.publicUrl).host -}}
{{- range $var := list "REFRESH_TOKEN_COOKIE_DOMAIN" "SESSION_COOKIE_DOMAIN" -}}
{{- $value := get $env $var -}}
{{- if $value -}}
{{- $domain := trimPrefix "." $value -}}
{{- if not (or (eq $host $domain) (hasSuffix (printf ".%s" $domain) $host)) -}}
{{- fail (printf "%s=%q in %s does not cover the Backoffice host %q: browsers would drop the Backoffice login cookies. Change the Directus env: remove the variable, or set a parent domain that covers both hosts (for example %q), then install again." $var $value (get $from $var) $host (regexReplaceAll "^[^.]+\\." $host "")) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- $reasons := list -}}
{{- $redis := false -}}
{{- if hasKey $env "REDIS_ENABLED" -}}
{{- $redis = has (get $env "REDIS_ENABLED") (list "true" "boolean:true") -}}
{{- else -}}
{{- range $k, $_ := $env -}}{{- if or (eq $k "REDIS") (hasPrefix "REDIS_" $k) -}}{{- $redis = true -}}{{- end -}}{{- end -}}
{{- end -}}
{{- if not $redis -}}
{{- $reasons = append $reasons "No Redis configured: set REDIS=redis://... (or REDIS_HOST...)" -}}
{{- end -}}
{{- range $var := list "CACHE_STORE" "RATE_LIMITER_STORE" -}}
{{- if ne (get $env $var | default "memory") "redis" -}}
{{- $reasons = append $reasons (printf "%s is %q: set %s=redis" $var (get $env $var | default "memory") $var) -}}
{{- end -}}
{{- end -}}
{{- if ne (get $env "SYNCHRONIZATION_STORE") "redis" -}}
{{- $reasons = append $reasons "SYNCHRONIZATION_STORE is not \"redis\" (scheduled flows run on every instance): set SYNCHRONIZATION_STORE=redis" -}}
{{- end -}}
{{- if not (get $env "SECRET") -}}
{{- $reasons = append $reasons "SECRET is not set (each instance generates its own: tokens fail across instances): set SECRET to one fixed value" -}}
{{- end -}}
{{- if has (get $env "DB_CLIENT" | default "sqlite3") (list "sqlite3") -}}
{{- $reasons = append $reasons "DB_CLIENT is \"sqlite3\" or not set (each container has its own database): set DB_CLIENT and DB_* to the shared database" -}}
{{- end -}}
{{- range $location := regexSplit "\\s*,\\s*" (get $env "STORAGE_LOCATIONS" | default "local") -1 -}}
{{- $driver := get $env (printf "STORAGE_%s_DRIVER" (upper $location)) | default (ternary "local" "" (eq $location "local")) -}}
{{- if and (eq $driver "local") (not $.Values.uploads.existingClaim) -}}
{{- $reasons = append $reasons (printf "storage location %q uses the local driver without a shared volume: use an s3 location, or set uploads.existingClaim (ReadWriteMany PVC)" $location) -}}
{{- end -}}
{{- end -}}
{{- if and (or .Values.api.autoscaling.enabled (gt (int .Values.api.replicas) 1)) (not (get $env "EXTENSIONS_LOCATION")) (not .Values.extensions.inImage) -}}
{{- $reasons = append $reasons "EXTENSIONS_LOCATION is empty: with several replicas extensions must come from shared storage (set EXTENSIONS_LOCATION in the Directus ConfigMap) or be baked into the image (extensions.inImage=true); upgrading from 019: see \"Extensions\" in deploy/README.md" -}}
{{- end -}}
{{- if $reasons -}}
{{- fail (printf "%s / %s are only safe for a single instance:\n  - %s\nChange the Directus env, then install again." (printf "ConfigMap %s" .Values.directus.configMap) (printf "Secret %s" .Values.directus.secret) (join "\n  - " $reasons)) -}}
{{- end -}}
{{- end -}}
{{- end -}}
