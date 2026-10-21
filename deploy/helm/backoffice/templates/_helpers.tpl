{{- define "backoffice.name" -}}{{ .Release.Name }}{{- end }}

{{- define "backoffice.pool" -}}{{ .Values.apiPool.name | default .Release.Name }}{{- end }}

{{- define "backoffice.labels" -}}
app.kubernetes.io/name: backoffice
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{- define "backoffice.selector" -}}
app.kubernetes.io/name: backoffice
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "backoffice.securityContext" -}}
allowPrivilegeEscalation: false
capabilities:
  drop: [ALL]
{{- end }}

{{- /* The uploads PVC (019) and the migrations ConfigMap (spec 021 FR-085) of the api pods and the bootstrap Job. */ -}}
{{- define "backoffice.volumeMounts" -}}
{{- if or .Values.uploads.existingClaim .Values.migrations.configMap -}}
volumeMounts:
{{- if .Values.uploads.existingClaim }}
  - { name: uploads, mountPath: /directus/uploads }
{{- end }}
{{- if .Values.migrations.configMap }}
  - { name: migrations, mountPath: /directus/migrations, readOnly: true }
{{- end }}
{{- end -}}
{{- end }}

{{- define "backoffice.volumes" -}}
{{- if or .Values.uploads.existingClaim .Values.migrations.configMap -}}
volumes:
{{- with .Values.uploads.existingClaim }}
  - name: uploads
    persistentVolumeClaim: { claimName: {{ . }} }
{{- end }}
{{- with .Values.migrations.configMap }}
  - name: migrations
    configMap: { name: {{ . }} }
{{- end }}
{{- end -}}
{{- end }}
