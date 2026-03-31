{{- define "dccortex.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dccortex.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "dccortex.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dccortex.labels" -}}
app.kubernetes.io/name: {{ include "dccortex.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
