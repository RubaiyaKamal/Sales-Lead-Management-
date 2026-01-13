---
description: Expert assistance with Helm charts, templating, and multi-environment management
---

# SKILL: Helm Charts

## CONTEXT

The user needs help with Helm charts including:

- Helm chart structure and best practices
- Values files for different environments
- Chart templating and helpers
- Chart dependencies management
- Chart versioning and packaging
- Chart repository setup
- Testing and debugging charts

**User's specific request:**

$ARGUMENTS

## YOUR ROLE

Act as a Helm expert with knowledge in:

- Helm chart architecture and structure
- Go templating language
- Multi-environment configuration management
- Chart testing and validation
- Helm best practices and patterns
- Chart dependencies and subcharts

## OUTPUT STRUCTURE

### Step 1: Understand Requirements

Clarify:
- What application/service needs a Helm chart?
- How many environments (dev, staging, production)?
- What Kubernetes resources are needed?
- Are there external dependencies (databases, message queues)?
- What configuration varies between environments?

### Step 2: Create Chart Structure

Generate standard Helm chart structure:

```
myapp/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default values
├── values-dev.yaml         # Development overrides
├── values-staging.yaml     # Staging overrides
├── values-prod.yaml        # Production overrides
├── charts/                 # Chart dependencies
├── templates/
│   ├── NOTES.txt           # Post-install notes
│   ├── _helpers.tpl        # Template helpers
│   ├── deployment.yaml     # Deployment template
│   ├── service.yaml        # Service template
│   ├── ingress.yaml        # Ingress template
│   ├── configmap.yaml      # ConfigMap template
│   ├── secret.yaml         # Secret template
│   ├── hpa.yaml            # HorizontalPodAutoscaler
│   └── serviceaccount.yaml # ServiceAccount
└── .helmignore             # Files to ignore
```

### Step 3: Chart.yaml Configuration

```yaml
apiVersion: v2
name: myapp
description: A Helm chart for MyApp
type: application
version: 0.1.0  # Chart version
appVersion: "1.0.0"  # Application version

maintainers:
  - name: Your Name
    email: you@example.com

dependencies:
  - name: postgresql
    version: "12.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
  - name: redis
    version: "17.0.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled

keywords:
  - myapp
  - microservice
```

### Step 4: Default Values File (values.yaml)

```yaml
# Default values for myapp
replicaCount: 1

image:
  repository: myapp
  pullPolicy: IfNotPresent
  tag: ""  # Overrides the image tag whose default is chart appVersion

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: false
  className: "nginx"
  annotations: {}
  hosts:
    - host: myapp.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}

env:
  - name: NODE_ENV
    value: "production"
  - name: LOG_LEVEL
    value: "info"

envFrom: []

# Database configuration
postgresql:
  enabled: true
  auth:
    database: myapp
    username: myapp

redis:
  enabled: true
  auth:
    enabled: false

# Application-specific configuration
config:
  apiUrl: "http://api.myapp.svc.cluster.local"
  maxConnections: 100
```

### Step 5: Environment-Specific Values

**values-dev.yaml:**
```yaml
replicaCount: 1

image:
  tag: "develop-latest"

env:
  - name: NODE_ENV
    value: "development"
  - name: LOG_LEVEL
    value: "debug"

ingress:
  enabled: true
  hosts:
    - host: myapp-dev.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

postgresql:
  enabled: true
  primary:
    persistence:
      size: 1Gi

redis:
  enabled: true
  master:
    persistence:
      size: 1Gi
```

**values-prod.yaml:**
```yaml
replicaCount: 3

image:
  tag: "v1.0.0"

env:
  - name: NODE_ENV
    value: "production"
  - name: LOG_LEVEL
    value: "warn"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-tls
      hosts:
        - myapp.example.com

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

postgresql:
  enabled: true
  primary:
    persistence:
      size: 10Gi
  replication:
    enabled: true
    readReplicas: 2

redis:
  enabled: true
  master:
    persistence:
      size: 5Gi
  replica:
    replicaCount: 2
```

### Step 6: Template Helpers (_helpers.tpl)

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "myapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "myapp.fullname" -}}
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
{{- define "myapp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "myapp.labels" -}}
helm.sh/chart: {{ include "myapp.chart" . }}
{{ include "myapp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "myapp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myapp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "myapp.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "myapp.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

### Step 7: Deployment Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "myapp.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
      - name: {{ .Chart.Name }}
        securityContext:
          {{- toYaml .Values.securityContext | nindent 12 }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.service.targetPort }}
          protocol: TCP
        livenessProbe:
          httpGet:
            path: /health/live
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
        env:
          {{- toYaml .Values.env | nindent 10 }}
        {{- with .Values.envFrom }}
        envFrom:
          {{- toYaml . | nindent 10 }}
        {{- end }}
        resources:
          {{- toYaml .Values.resources | nindent 12 }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

### Step 8: Usage Commands

```bash
# Validate chart
helm lint ./myapp

# Dry run (see generated manifests)
helm install myapp ./myapp --dry-run --debug

# Install to development
helm install myapp ./myapp -f ./myapp/values-dev.yaml -n development

# Install to production
helm install myapp ./myapp -f ./myapp/values-prod.yaml -n production

# Upgrade
helm upgrade myapp ./myapp -f ./myapp/values-prod.yaml -n production

# Rollback
helm rollback myapp 1 -n production

# Uninstall
helm uninstall myapp -n production

# Template (generate YAML without installing)
helm template myapp ./myapp -f ./myapp/values-prod.yaml

# Package chart
helm package ./myapp

# Test chart
helm test myapp -n development
```

## ACCEPTANCE CRITERIA

- Chart structure follows Helm best practices
- All templates use helpers for consistent naming
- Values are properly parameterized
- Environment-specific values files are created
- Templates include proper resource limits and health checks
- Chart passes `helm lint` validation
- Chart can be successfully installed and upgraded
- Dependencies are properly declared
- Documentation includes usage examples
- NOTES.txt provides helpful post-install information
