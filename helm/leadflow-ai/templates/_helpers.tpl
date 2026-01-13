{{/*
Expand the name of the chart.
*/}}
{{- define "leadflow-ai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "leadflow-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "leadflow-ai.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "leadflow-ai.labels" -}}
helm.sh/chart: {{ include "leadflow-ai.chart" . }}
{{ include "leadflow-ai.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: leadflow-ai
environment: {{ .Values.global.environment }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "leadflow-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "leadflow-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "leadflow-ai.backend.labels" -}}
{{ include "leadflow-ai.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "leadflow-ai.backend.selectorLabels" -}}
{{ include "leadflow-ai.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Notification service labels
*/}}
{{- define "leadflow-ai.notification.labels" -}}
{{ include "leadflow-ai.labels" . }}
app.kubernetes.io/component: notification-service
{{- end }}

{{/*
Notification service selector labels
*/}}
{{- define "leadflow-ai.notification.selectorLabels" -}}
{{ include "leadflow-ai.selectorLabels" . }}
app.kubernetes.io/component: notification-service
{{- end }}

{{/*
Follow-up service labels
*/}}
{{- define "leadflow-ai.followup.labels" -}}
{{ include "leadflow-ai.labels" . }}
app.kubernetes.io/component: follow-up-service
{{- end }}

{{/*
Follow-up service selector labels
*/}}
{{- define "leadflow-ai.followup.selectorLabels" -}}
{{ include "leadflow-ai.selectorLabels" . }}
app.kubernetes.io/component: follow-up-service
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "leadflow-ai.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "leadflow-ai.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Dapr annotations for backend
*/}}
{{- define "leadflow-ai.backend.daprAnnotations" -}}
{{- if .Values.backend.dapr.enabled }}
dapr.io/enabled: "true"
dapr.io/app-id: {{ .Values.backend.dapr.appId | quote }}
dapr.io/app-port: {{ .Values.backend.dapr.appPort | quote }}
dapr.io/app-protocol: {{ .Values.backend.dapr.appProtocol | quote }}
dapr.io/log-level: {{ .Values.backend.dapr.logLevel | quote }}
{{- if .Values.backend.dapr.enableMetrics }}
dapr.io/enable-metrics: "true"
dapr.io/metrics-port: {{ .Values.backend.dapr.metricsPort | quote }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Dapr annotations for notification service
*/}}
{{- define "leadflow-ai.notification.daprAnnotations" -}}
{{- if .Values.notificationService.dapr.enabled }}
dapr.io/enabled: "true"
dapr.io/app-id: {{ .Values.notificationService.dapr.appId | quote }}
dapr.io/app-port: {{ .Values.notificationService.dapr.appPort | quote }}
dapr.io/app-protocol: {{ .Values.notificationService.dapr.appProtocol | quote }}
dapr.io/log-level: {{ .Values.notificationService.dapr.logLevel | quote }}
{{- end }}
{{- end }}

{{/*
Dapr annotations for follow-up service
*/}}
{{- define "leadflow-ai.followup.daprAnnotations" -}}
{{- if .Values.followUpService.dapr.enabled }}
dapr.io/enabled: "true"
dapr.io/app-id: {{ .Values.followUpService.dapr.appId | quote }}
dapr.io/app-port: {{ .Values.followUpService.dapr.appPort | quote }}
dapr.io/app-protocol: {{ .Values.followUpService.dapr.appProtocol | quote }}
dapr.io/log-level: {{ .Values.followUpService.dapr.logLevel | quote }}
{{- end }}
{{- end }}

{{/*
Environment variables from ConfigMap
*/}}
{{- define "leadflow-ai.envFromConfigMap" -}}
{{- if .Values.configMap.create }}
- configMapRef:
    name: {{ include "leadflow-ai.fullname" . }}-config
{{- end }}
{{- end }}

{{/*
Backend image
*/}}
{{- define "leadflow-ai.backend.image" -}}
{{- printf "%s:%s" .Values.backend.image.repository (.Values.backend.image.tag | default .Chart.AppVersion) }}
{{- end }}

{{/*
Notification service image
*/}}
{{- define "leadflow-ai.notification.image" -}}
{{- printf "%s:%s" .Values.notificationService.image.repository (.Values.notificationService.image.tag | default .Chart.AppVersion) }}
{{- end }}

{{/*
Follow-up service image
*/}}
{{- define "leadflow-ai.followup.image" -}}
{{- printf "%s:%s" .Values.followUpService.image.repository (.Values.followUpService.image.tag | default .Chart.AppVersion) }}
{{- end }}
