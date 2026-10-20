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
