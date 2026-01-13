# Quickstart Guide: Lead Management with AI Qualification (Kubernetes)

**Feature**: Lead CRUD with AI Scoring (001-lead-crud-ai)
**Last Updated**: 2025-12-31
**Architecture**: Kubernetes + Redpanda + Dapr

**Reference Skills**:
- `.claude/skills/kubernetes-deployment.md`
- `.claude/skills/docker-containerization.md`
- `.claude/skills/kafka-redpanda.md`
- `.claude/skills/dapr-microservices.md`
- `.claude/skills/helm-charts.md`

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Local Development (Minikube)](#part-1-local-development-minikube)
3. [Part 2: Production Deployment (DOKS)](#part-2-production-deployment-doks)
4. [Part 3: Testing & Verification](#part-3-testing--verification)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# 1. Docker Desktop (includes Minikube support)
# Download from: https://www.docker.com/products/docker-desktop

# 2. Minikube (Local Kubernetes)
# macOS
brew install minikube

# Windows (via Chocolatey)
choco install minikube

# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# 3. kubectl (Kubernetes CLI)
brew install kubectl

# 4. Helm (Kubernetes Package Manager)
brew install helm

# 5. Dapr CLI
curl -fsSL https://raw.githubusercontent.com/dapr/cli/master/install/install.sh | bash

# 6. Node.js 20+ and npm
brew install node@20

# 7. Git
brew install git

# Verify installations
minikube version
kubectl version --client
helm version
dapr --version
node --version
```

### Cloud Accounts (for Production)

1. **DigitalOcean Account**
   - Sign up: https://digitalocean.com
   - Get **$200 credit for 60 days** (credit card required)
   - Install doctl CLI: `brew install doctl`

2. **Redpanda Cloud Account**
   - Sign up: https://redpanda.com/cloud
   - **Free serverless tier** (no credit card needed)
   - Kafka-compatible API

3. **Neon DB Account**
   - Sign up: https://neon.tech
   - **Free tier**: 3GB storage, 100 hours compute/month

4. **Anthropic Claude API**
   - Get API key: https://console.anthropic.com

---

## Part 1: Local Development (Minikube)

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/leadflowai.git
cd leadflowai
git checkout 001-lead-crud-ai
```

### Step 2: Start Minikube Cluster

```bash
# Start Minikube with sufficient resources
minikube start --cpus=4 --memory=8192 --driver=docker

# Verify cluster is running
kubectl cluster-info
kubectl get nodes

# Enable Ingress addon
minikube addons enable ingress

# Expected output:
# minikube
# type: Control Plane
# host: Running
# kubelet: Running
```

### Step 3: Install Dapr on Minikube

```bash
# Initialize Dapr on Kubernetes
dapr init -k

# Verify Dapr installation
dapr status -k

# Expected output:
# NAME                   NAMESPACE    HEALTHY  STATUS   REPLICAS
# dapr-sidecar-injector  dapr-system  True     Running  1
# dapr-sentry            dapr-system  True     Running  1
# dapr-operator          dapr-system  True     Running  1
# dapr-placement-server  dapr-system  True     Running  1
```

### Step 4: Set Up Local Services (Docker Compose)

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  # Redpanda (Kafka-compatible)
  redpanda:
    image: redpandadata/redpanda:latest
    container_name: redpanda
    command:
      - redpanda start
      - --smp 1
      - --memory 512M
      - --overprovisioned
      - --kafka-addr PLAINTEXT://0.0.0.0:9092
      - --advertise-kafka-addr PLAINTEXT://localhost:9092
    ports:
      - "9092:9092"    # Kafka API
      - "8081:8081"    # Schema Registry
      - "8082:8082"    # REST Proxy
      - "9644:9644"    # Admin API
    volumes:
      - redpanda-data:/var/lib/redpanda/data
    networks:
      - leadflow-network

  # PostgreSQL (Local dev database)
  postgres:
    image: postgres:15-alpine
    container_name: leadflow-postgres
    environment:
      POSTGRES_DB: leadflow_dev
      POSTGRES_USER: leadflow
      POSTGRES_PASSWORD: dev_password_123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U leadflow"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - leadflow-network

  # Redis (Dapr State Store)
  redis:
    image: redis:7-alpine
    container_name: leadflow-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - leadflow-network

  # Redis Commander (UI for Redis)
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: leadflow-redis-ui
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis
    networks:
      - leadflow-network

volumes:
  redpanda-data:
  postgres_data:
  redis_data:

networks:
  leadflow-network:
    driver: bridge
```

**Start services**:

```bash
docker-compose up -d

# Verify all services are running
docker-compose ps

# Expected output:
# NAME                  STATUS    PORTS
# redpanda              Up        0.0.0.0:9092->9092/tcp
# leadflow-postgres     Up        0.0.0.0:5432->5432/tcp
# leadflow-redis        Up        0.0.0.0:6379->6379/tcp
# leadflow-redis-ui     Up        0.0.0.0:8081->8081/tcp
```

**Access UIs**:
- Redis Commander: http://localhost:8081

### Step 5: Create Kafka Topics

```bash
# Create topics using Redpanda CLI (rpk)
docker exec -it redpanda rpk topic create lead-events --partitions 3
docker exec -it redpanda rpk topic create notifications --partitions 3
docker exec -it redpanda rpk topic create follow-up-events --partitions 3
docker exec -it redpanda rpk topic create ai-qualification --partitions 3

# List topics
docker exec -it redpanda rpk topic list

# Expected output:
# NAME                 PARTITIONS  REPLICAS
# lead-events          3           1
# notifications        3           1
# follow-up-events     3           1
# ai-qualification     3           1
```

### Step 6: Run Database Migrations

```bash
# Install PostgreSQL client (if not installed)
brew install postgresql

# Run initial schema migration
psql postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev \
  -f specs/001-lead-crud-ai/migrations/V001__initial_schema.sql

# Verify tables created
psql postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev -c "\dt"

# Expected output:
#  Schema |     Name      | Type  |  Owner
# --------+---------------+-------+----------
#  public | users         | table | leadflow
#  public | leads         | table | leadflow
#  public | lead_scores   | table | leadflow
#  public | activity_logs | table | leadflow
```

**Create migration file** (if not exists):

```bash
mkdir -p specs/001-lead-crud-ai/migrations

# Copy SQL schema from data-model.md section "Database Schema Migration"
# Save to: specs/001-lead-crud-ai/migrations/V001__initial_schema.sql
```

### Step 7: Configure Dapr Components

Create `kubernetes/dapr-components/` directory:

```bash
mkdir -p kubernetes/dapr-components
```

**1. Kafka Pub/Sub Component**:

```yaml
# kubernetes/dapr-components/kafka-pubsub.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
  namespace: default
spec:
  type: pubsub.kafka
  version: v1
  metadata:
    - name: brokers
      value: "host.minikube.internal:9092"
    - name: authType
      value: "none"
    - name: consumerGroup
      value: "leadflow-group"
    - name: clientId
      value: "leadflow-client"
```

**2. Redis State Store Component**:

```yaml
# kubernetes/dapr-components/redis-statestore.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore
  namespace: default
spec:
  type: state.redis
  version: v1
  metadata:
    - name: redisHost
      value: "host.minikube.internal:6379"
    - name: redisPassword
      value: ""
```

**3. Kubernetes Secrets Component**:

```yaml
# kubernetes/dapr-components/kubernetes-secrets.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: kubernetes-secrets
  namespace: default
spec:
  type: secretstores.kubernetes
  version: v1
  metadata: []
```

**4. Cron Binding (Follow-ups)**:

```yaml
# kubernetes/dapr-components/followup-cron.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: followup-cron
  namespace: default
spec:
  type: bindings.cron
  version: v1
  metadata:
    - name: schedule
      value: "*/5 * * * *"  # Every 5 minutes
    - name: direction
      value: "input"
```

**Apply Dapr components**:

```bash
kubectl apply -f kubernetes/dapr-components/
```

### Step 8: Build Docker Images

**Backend API**:

```bash
cd backend

# Create Dockerfile (if not exists)
cat > Dockerfile << 'EOF'
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main.js"]
EOF

# Build image
docker build -t leadflow-backend:latest .

# Load image into Minikube
minikube image load leadflow-backend:latest
```

**Notification Service**:

```bash
cd services/notification-service

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8001
CMD ["node", "src/main.js"]
EOF

docker build -t leadflow-notification:latest .
minikube image load leadflow-notification:latest
```

### Step 9: Create Helm Chart

```bash
mkdir -p helm/leadflow-ai
cd helm/leadflow-ai
```

**Chart.yaml**:

```yaml
apiVersion: v2
name: leadflow-ai
description: Sales Lead Management with AI Qualification
type: application
version: 1.0.0
appVersion: "1.0.0"
```

**values-dev.yaml** (Minikube):

```yaml
# Backend API
backend:
  name: backend-api
  replicaCount: 1
  image:
    repository: leadflow-backend
    tag: latest
    pullPolicy: IfNotPresent
  service:
    type: NodePort
    port: 8000
  env:
    - name: NODE_ENV
      value: "development"
    - name: LOG_LEVEL
      value: "debug"
    - name: DATABASE_URL
      value: "postgresql://leadflow:dev_password_123@host.minikube.internal:5432/leadflow_dev"
    - name: CLAUDE_API_KEY
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: claude-api-key
  dapr:
    enabled: true
    appId: backend-api
    appPort: 8000
  resources:
    requests:
      memory: "128Mi"
      cpu: "100m"
    limits:
      memory: "256Mi"
      cpu: "200m"

# Notification Service
notificationService:
  name: notification-service
  replicaCount: 1
  image:
    repository: leadflow-notification
    tag: latest
    pullPolicy: IfNotPresent
  service:
    type: ClusterIP
    port: 8001
  dapr:
    enabled: true
    appId: notification-service
    appPort: 8001
  resources:
    requests:
      memory: "64Mi"
      cpu: "50m"
    limits:
      memory: "128Mi"
      cpu: "100m"

# Ingress
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: leadflow.local
      paths:
        - path: /
          pathType: Prefix
          backend:
            service:
              name: backend-api
              port: 8000
```

**templates/backend-deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.backend.name }}
  annotations:
    dapr.io/enabled: "{{ .Values.backend.dapr.enabled }}"
    dapr.io/app-id: "{{ .Values.backend.dapr.appId }}"
    dapr.io/app-port: "{{ .Values.backend.dapr.appPort }}"
    dapr.io/log-level: "info"
spec:
  replicas: {{ .Values.backend.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Values.backend.name }}
  template:
    metadata:
      labels:
        app: {{ .Values.backend.name }}
    spec:
      containers:
      - name: {{ .Values.backend.name }}
        image: "{{ .Values.backend.image.repository }}:{{ .Values.backend.image.tag }}"
        imagePullPolicy: {{ .Values.backend.image.pullPolicy }}
        ports:
        - containerPort: {{ .Values.backend.service.port }}
        env:
        {{- range .Values.backend.env }}
        - name: {{ .name }}
          {{- if .value }}
          value: {{ .value | quote }}
          {{- else if .valueFrom }}
          valueFrom:
            {{- toYaml .valueFrom | nindent 12 }}
          {{- end }}
        {{- end }}
        livenessProbe:
          httpGet:
            path: /health/live
            port: {{ .Values.backend.service.port }}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: {{ .Values.backend.service.port }}
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          {{- toYaml .Values.backend.resources | nindent 10 }}
```

**templates/backend-service.yaml**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.backend.name }}-service
spec:
  selector:
    app: {{ .Values.backend.name }}
  type: {{ .Values.backend.service.type }}
  ports:
  - port: {{ .Values.backend.service.port }}
    targetPort: {{ .Values.backend.service.port }}
    protocol: TCP
```

**templates/secrets.yaml**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  claude-api-key: "sk-ant-api03-xxxxx"  # Replace with your API key
```

**templates/ingress.yaml**:

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: leadflow-ingress
spec:
  ingressClassName: {{ .Values.ingress.className }}
  rules:
  {{- range .Values.ingress.hosts }}
  - host: {{ .host }}
    http:
      paths:
      {{- range .paths }}
      - path: {{ .path }}
        pathType: {{ .pathType }}
        backend:
          service:
            name: {{ .backend.service.name }}-service
            port:
              number: {{ .backend.service.port }}
      {{- end }}
  {{- end }}
{{- end }}
```

### Step 10: Deploy to Minikube

```bash
# Create namespace
kubectl create namespace development

# Create secret with Claude API key
kubectl create secret generic app-secrets \
  --from-literal=claude-api-key=sk-ant-api03-xxxxx \
  -n development

# Install Helm chart
helm install leadflow ./helm/leadflow-ai \
  -f ./helm/leadflow-ai/values-dev.yaml \
  -n development

# Check deployment status
kubectl get pods -n development
kubectl get services -n development

# Expected output:
# NAME                              READY   STATUS    RESTARTS
# backend-api-xxx-yyy               2/2     Running   0          (2/2 = app + dapr sidecar)
# notification-service-xxx-yyy      2/2     Running   0
```

### Step 11: Test Local Deployment

**Port Forward to Access API**:

```bash
# Port forward backend service
kubectl port-forward -n development svc/backend-api-service 8000:8000

# In another terminal, test health endpoint
curl http://localhost:8000/health/live

# Expected: {"status":"healthy","timestamp":"2025-12-31T12:00:00.000Z"}
```

**Test Lead Creation**:

```bash
# Create a lead
curl -X POST http://localhost:8000/api/v1/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-jwt-token" \
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "company": "Test Company",
    "leadSource": "website",
    "metadata": {
      "utm_source": "google",
      "utm_medium": "cpc"
    }
  }'

# Expected: 201 Created with lead object
```

**Check Kafka Events**:

```bash
# Consume lead-events topic
docker exec -it redpanda rpk topic consume lead-events

# You should see the lead.created event
```

**Access via Ingress (Add to /etc/hosts)**:

```bash
# Get Minikube IP
minikube ip
# Example output: 192.168.49.2

# Add to /etc/hosts
sudo echo "192.168.49.2 leadflow.local" >> /etc/hosts

# Test via Ingress
curl http://leadflow.local/health/live
```

---

## Part 2: Production Deployment (DOKS)

### Step 1: Create DigitalOcean Kubernetes Cluster

```bash
# Authenticate with DigitalOcean
doctl auth init
# Paste your API token from https://cloud.digitalocean.com/account/api/tokens

# Create Kubernetes cluster (3-node, s-2vcpu-4gb)
doctl kubernetes cluster create leadflow-prod \
  --region nyc1 \
  --version 1.28.2-do.0 \
  --count 3 \
  --size s-2vcpu-4gb \
  --wait

# Get cluster credentials
doctl kubernetes cluster kubeconfig save leadflow-prod

# Verify connection
kubectl cluster-info
kubectl get nodes

# Expected: 3 nodes in Ready state
```

### Step 2: Create DigitalOcean Container Registry

```bash
# Create container registry
doctl registry create leadflow-registry

# Login to registry
doctl registry login

# Tag and push images
docker tag leadflow-backend:latest registry.digitalocean.com/leadflow-registry/backend:v1.0.0
docker tag leadflow-notification:latest registry.digitalocean.com/leadflow-registry/notification:v1.0.0

docker push registry.digitalocean.com/leadflow-registry/backend:v1.0.0
docker push registry.digitalocean.com/leadflow-registry/notification:v1.0.0

# Link registry to cluster (allows pulling images without auth)
doctl kubernetes cluster registry add leadflow-prod
```

### Step 3: Set Up Redpanda Cloud

```bash
# Go to https://redpanda.com/cloud
# 1. Create account (no credit card for free tier)
# 2. Create Serverless cluster
#    - Region: us-east-1 (closest to NYC1)
#    - Name: leadflow-kafka
# 3. Create topics via UI:
#    - lead-events (3 partitions)
#    - notifications (3 partitions)
#    - follow-up-events (3 partitions)
#    - ai-qualification (3 partitions)
# 4. Get connection details:
#    - Bootstrap server: seed-xxx.cloud.redpanda.com:9092
#    - SASL username
#    - SASL password
```

### Step 4: Set Up Neon DB (Production Database)

```bash
# Go to https://neon.tech
# 1. Create account
# 2. Create project: leadflow-prod
# 3. Create database: leadflow_prod
# 4. Get connection string:
#    postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/leadflow_prod?sslmode=require

# Run migrations
psql "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/leadflow_prod?sslmode=require" \
  -f specs/001-lead-crud-ai/migrations/V001__initial_schema.sql
```

### Step 5: Install Dapr on DOKS

```bash
# Initialize Dapr on DOKS
dapr init -k

# Verify installation
dapr status -k
```

### Step 6: Configure Production Dapr Components

**Update Kafka component for Redpanda Cloud**:

```yaml
# kubernetes/dapr-components/kafka-pubsub-prod.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
  namespace: production
spec:
  type: pubsub.kafka
  version: v1
  metadata:
    - name: brokers
      value: "seed-xxx.cloud.redpanda.com:9092"
    - name: authType
      value: "password"
    - name: saslUsername
      secretKeyRef:
        name: kafka-secret
        key: username
    - name: saslPassword
      secretKeyRef:
        name: kafka-secret
        key: password
    - name: maxMessageBytes
      value: "1024000"
    - name: consumerGroup
      value: "leadflow-prod-group"
```

**Create secrets**:

```bash
# Create namespace
kubectl create namespace production

# Kafka credentials
kubectl create secret generic kafka-secret \
  --from-literal=username=YOUR-REDPANDA-USERNAME \
  --from-literal=password=YOUR-REDPANDA-PASSWORD \
  -n production

# Application secrets
kubectl create secret generic app-secrets \
  --from-literal=claude-api-key=sk-ant-api03-xxxxx \
  --from-literal=database-url="postgresql://user:pass@ep-xxx.neon.tech/leadflow_prod?sslmode=require" \
  -n production

# Apply Dapr components
kubectl apply -f kubernetes/dapr-components/kafka-pubsub-prod.yaml -n production
kubectl apply -f kubernetes/dapr-components/redis-statestore.yaml -n production
kubectl apply -f kubernetes/dapr-components/kubernetes-secrets.yaml -n production
```

### Step 7: Create Production Helm Values

**values-prod.yaml**:

```yaml
backend:
  name: backend-api
  replicaCount: 3
  image:
    repository: registry.digitalocean.com/leadflow-registry/backend
    tag: v1.0.0
    pullPolicy: Always
  service:
    type: ClusterIP
    port: 8000
  env:
    - name: NODE_ENV
      value: "production"
    - name: LOG_LEVEL
      value: "info"
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: database-url
    - name: CLAUDE_API_KEY
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: claude-api-key
  dapr:
    enabled: true
    appId: backend-api
    appPort: 8000
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

notificationService:
  name: notification-service
  replicaCount: 2
  image:
    repository: registry.digitalocean.com/leadflow-registry/notification
    tag: v1.0.0
  dapr:
    enabled: true
    appId: notification-service
    appPort: 8001

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: api.leadflowai.com
      paths:
        - path: /
          pathType: Prefix
          backend:
            service:
              name: backend-api
              port: 8000
  tls:
    - secretName: leadflow-tls
      hosts:
        - api.leadflowai.com
```

### Step 8: Deploy to DOKS

```bash
# Install Helm chart to production
helm install leadflow ./helm/leadflow-ai \
  -f ./helm/leadflow-ai/values-prod.yaml \
  -n production \
  --wait

# Check deployment
kubectl get pods -n production
kubectl get services -n production
kubectl get ingress -n production

# Get LoadBalancer IP
kubectl get svc -n production

# Update DNS A record:
# api.leadflowai.com → EXTERNAL-IP from LoadBalancer
```

### Step 9: Set Up Monitoring (Prometheus + Grafana)

```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus + Grafana stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Open http://localhost:3000
# Default credentials:
# Username: admin
# Password: prom-operator

# Import Kubernetes dashboards from grafana.com
```

---

## Part 3: Testing & Verification

### Local Testing (Minikube)

```bash
# 1. Health checks
curl http://leadflow.local/health/live
curl http://leadflow.local/health/ready

# 2. Create lead
curl -X POST http://leadflow.local/api/v1/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-jwt" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Corp",
    "leadSource": "website"
  }'

# 3. List leads
curl http://leadflow.local/api/v1/leads

# 4. Verify Kafka events
docker exec -it redpanda rpk topic consume lead-events

# 5. Check Redis cache
docker exec -it leadflow-redis redis-cli
> KEYS leads:*
> GET leads:list:xxx

# 6. Check pod logs
kubectl logs -n development -l app=backend-api -c backend-api
kubectl logs -n development -l app=backend-api -c daprd  # Dapr sidecar logs
```

### Production Testing (DOKS)

```bash
# 1. Health checks
curl https://api.leadflowai.com/health/live

# 2. Load testing
# Install k6
brew install k6

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100,
  duration: '30s',
};

export default function() {
  let res = http.post('https://api.leadflowai.com/api/v1/leads', JSON.stringify({
    name: 'Load Test',
    email: `test-${__VU}-${__ITER}@example.com`,
    leadSource: 'website'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF

# Run load test
k6 run load-test.js

# 3. Monitor metrics in Grafana
# Open http://localhost:3000 (port-forwarded)
```

---

## Troubleshooting

### Minikube Issues

**Issue**: Pods not starting

```bash
# Check pod status
kubectl get pods -n development
kubectl describe pod <pod-name> -n development

# Check logs
kubectl logs <pod-name> -n development -c backend-api
kubectl logs <pod-name> -n development -c daprd

# Common fix: Restart Minikube
minikube delete
minikube start --cpus=4 --memory=8192 --driver=docker
```

**Issue**: Cannot access services via Ingress

```bash
# Check Ingress status
kubectl get ingress -n development
minikube addons list

# Enable Ingress if disabled
minikube addons enable ingress

# Get Minikube IP and add to /etc/hosts
minikube ip
sudo vi /etc/hosts
# Add: 192.168.49.2 leadflow.local
```

**Issue**: Dapr sidecar not injecting

```bash
# Verify Dapr installation
dapr status -k

# Reinstall Dapr
dapr uninstall -k
dapr init -k

# Check annotations on deployment
kubectl get deployment backend-api -n development -o yaml | grep dapr
```

### Docker Compose Issues

**Issue**: Redpanda not starting

```bash
# Check logs
docker logs redpanda

# Restart Redpanda
docker-compose restart redpanda

# Recreate with fresh data
docker-compose down -v
docker-compose up -d
```

**Issue**: Cannot connect to PostgreSQL

```bash
# Test connection
psql postgresql://leadflow:dev_password_123@localhost:5432/leadflow_dev -c "SELECT 1"

# Check if port is in use
lsof -i :5432

# Restart PostgreSQL container
docker-compose restart postgres
```

### DOKS Issues

**Issue**: Pods in ImagePullBackOff

```bash
# Link registry to cluster
doctl kubernetes cluster registry add leadflow-prod

# Verify image exists in registry
doctl registry repository list-v2

# Check pod events
kubectl describe pod <pod-name> -n production
```

**Issue**: High resource usage

```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n production

# Scale down if needed
kubectl scale deployment backend-api --replicas=2 -n production
```

---

## Useful Commands

### Kubernetes

```bash
# View all resources
kubectl get all -n development

# Restart deployment
kubectl rollout restart deployment/backend-api -n development

# View logs (follow)
kubectl logs -f deployment/backend-api -n development -c backend-api

# Execute command in pod
kubectl exec -it <pod-name> -n development -- sh

# Port forward
kubectl port-forward svc/backend-api-service 8000:8000 -n development
```

### Helm

```bash
# List releases
helm list -n development

# Upgrade deployment
helm upgrade leadflow ./helm/leadflow-ai -f values-dev.yaml -n development

# Rollback
helm rollback leadflow 1 -n development

# Uninstall
helm uninstall leadflow -n development

# Debug (render templates without installing)
helm template leadflow ./helm/leadflow-ai -f values-dev.yaml
```

### Dapr

```bash
# List Dapr components
kubectl get components -n development

# View Dapr dashboard
dapr dashboard -k

# Invoke Dapr sidecar directly
curl http://localhost:3500/v1.0/invoke/backend-api/method/health/live
```

### Docker

```bash
# View running containers
docker ps

# View logs
docker logs redpanda -f

# Execute command in container
docker exec -it redpanda rpk topic list

# Clean up
docker-compose down -v
docker system prune -a
```

---

## Next Steps

1. **Set up CI/CD**: Configure GitHub Actions for automated deployment (see `.claude/skills/ci-cd-github-actions.md`)
2. **Configure DNS**: Point `api.leadflowai.com` to DOKS LoadBalancer IP
3. **Set up TLS**: Install cert-manager and configure Let's Encrypt
4. **Add monitoring**: Set up Prometheus alerts and Grafana dashboards
5. **Run `/sp.tasks`**: Generate implementation tasks for backend development

---

**Resources**:
- Minikube Docs: https://minikube.sigs.k8s.io/docs/
- DOKS Guide: https://docs.digitalocean.com/products/kubernetes/
- Dapr Docs: https://docs.dapr.io/
- Redpanda Cloud: https://docs.redpanda.com/current/get-started/cloud/
- Neon DB: https://neon.tech/docs/introduction
- Helm Docs: https://helm.sh/docs/

**Happy deploying!** 🚀
