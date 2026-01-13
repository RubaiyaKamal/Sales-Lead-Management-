# Production Deployment Guide - LeadFlow AI

This guide covers deploying LeadFlow AI to DigitalOcean Kubernetes (DOKS) for production.

## Prerequisites

- DigitalOcean account with DOKS cluster provisioned
- `doctl` CLI installed and configured
- `kubectl` installed
- `helm` 3.x installed
- `dapr` CLI installed
- GitHub repository with Actions enabled

## Architecture Overview

**Production Stack:**
- **Kubernetes**: DigitalOcean Kubernetes (DOKS) 3-node cluster
- **Database**: Neon DB (serverless PostgreSQL)
- **Cache**: DigitalOcean Managed Redis
- **Event Streaming**: Redpanda Cloud (serverless Kafka)
- **Container Registry**: GitHub Container Registry (ghcr.io)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

**Cost Estimate**: ~$161/month (40% cheaper than AWS serverless)

---

## Step 1: Provision Infrastructure

### 1.1 Create DOKS Cluster

```bash
# Via DigitalOcean CLI
doctl kubernetes cluster create leadflow-prod \
  --region nyc1 \
  --version 1.28.2-do.0 \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=3;auto-scale=true;min-nodes=3;max-nodes=10"

# Get kubeconfig
doctl kubernetes cluster kubeconfig save leadflow-prod
```

### 1.2 Set up Neon DB (PostgreSQL)

1. Sign up at https://neon.tech
2. Create a new project: "LeadFlow Production"
3. Create database: `leadflow_production`
4. Note the connection string (starts with `postgresql://`)

### 1.3 Set up DigitalOcean Managed Redis

```bash
doctl databases create leadflow-redis \
  --engine redis \
  --region nyc1 \
  --size db-s-1vcpu-1gb \
  --version 7
```

### 1.4 Set up Redpanda Cloud

1. Sign up at https://redpanda.com/cloud
2. Create a serverless cluster: "leadflow-production"
3. Create topics:
   - `lead-events`
   - `notifications`
   - `ai-qualification`
   - `follow-up-events`
4. Create SASL/SCRAM credentials and note username/password

---

## Step 2: Configure External Services

### 2.1 Anthropic Claude API

1. Sign up at https://console.anthropic.com
2. Create API key
3. Note the key (starts with `sk-ant-`)

### 2.2 SendGrid (Email)

1. Sign up at https://sendgrid.com
2. Create API key with "Mail Send" permission
3. Verify sender email address

### 2.3 Twilio (WhatsApp)

1. Sign up at https://twilio.com
2. Get Account SID and Auth Token
3. Enable WhatsApp sandbox or apply for production access
4. Note WhatsApp number (format: `whatsapp:+14155238886`)

---

## Step 3: Install Dapr on Kubernetes

```bash
# Initialize Dapr
dapr init --kubernetes --wait --runtime-version 1.12

# Verify installation
kubectl get pods -n dapr-system

# Expected output:
# dapr-operator
# dapr-sidecar-injector
# dapr-sentry
# dapr-placement-server
```

---

## Step 4: Configure GitHub Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```bash
# DigitalOcean
DIGITALOCEAN_ACCESS_TOKEN=<your-do-token>
DOKS_CLUSTER_NAME=leadflow-prod

# Database
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech:5432/leadflow_production?sslmode=require

# JWT
JWT_SECRET=<generate with: openssl rand -base64 32>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx

# SendGrid
SENDGRID_API_KEY=SG.xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Redis
REDIS_PASSWORD=<from DigitalOcean Managed Redis>

# Kafka (Redpanda)
KAFKA_AUTH_TYPE=sasl
KAFKA_SASL_USERNAME=<from Redpanda Cloud>
KAFKA_SASL_PASSWORD=<from Redpanda Cloud>
```

---

## Step 5: Update Production Values

Edit `helm/leadflow-ai/values-prod.yaml`:

```yaml
global:
  domain: api.yourdomain.com  # Your actual domain

postgresql:
  host: ep-xxx.us-east-2.aws.neon.tech  # From Neon DB
  database: leadflow_production
  username: your_user

redis:
  host: leadflow-redis-do-user-xxx-0.b.db.ondigitalocean.com  # From DO Redis
  port: 25061  # From DO Redis
  tls: true

kafka:
  brokers:
    - seed-xxx.cloud.redpanda.com:9092  # From Redpanda Cloud

ingress:
  hosts:
    - host: api.yourdomain.com  # Your actual domain
  tls:
    - secretName: leadflow-ai-tls
      hosts:
        - api.yourdomain.com
```

---

## Step 6: DNS Configuration

1. Point your domain to DOKS Load Balancer:
   ```bash
   # After deploying ingress, get the Load Balancer IP
   kubectl get ingress -n leadflow-ai
   ```

2. Create DNS A record:
   ```
   api.yourdomain.com → <LOAD_BALANCER_IP>
   ```

3. For SSL/TLS with Let's Encrypt:
   ```bash
   # Install cert-manager
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

   # Create ClusterIssuer
   kubectl apply -f - <<EOF
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: your-email@example.com
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
       - http01:
           ingress:
             class: nginx
   EOF
   ```

---

## Step 7: Deploy Application

### Option A: Manual Deployment

```bash
# 1. Create namespace
kubectl create namespace leadflow-ai

# 2. Apply Dapr components
kubectl apply -f kubernetes/dapr-components/ -n leadflow-ai

# 3. Create secrets
kubectl create secret generic leadflow-database-secret \
  --from-literal=DATABASE_URL="postgresql://..." \
  -n leadflow-ai

kubectl create secret generic leadflow-jwt-secret \
  --from-literal=JWT_SECRET="..." \
  -n leadflow-ai

kubectl create secret generic leadflow-anthropic-secret \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-..." \
  -n leadflow-ai

kubectl create secret generic leadflow-sendgrid-secret \
  --from-literal=SENDGRID_API_KEY="SG...." \
  -n leadflow-ai

kubectl create secret generic leadflow-twilio-secret \
  --from-literal=TWILIO_ACCOUNT_SID="AC..." \
  --from-literal=TWILIO_AUTH_TOKEN="..." \
  --from-literal=TWILIO_WHATSAPP_NUMBER="whatsapp:+..." \
  -n leadflow-ai

kubectl create secret generic leadflow-redis-secret \
  --from-literal=password="..." \
  -n leadflow-ai

kubectl create secret generic leadflow-kafka-secret \
  --from-literal=authType="sasl" \
  --from-literal=saslUsername="..." \
  --from-literal=saslPassword="..." \
  -n leadflow-ai

# 4. Deploy with Helm
helm install leadflow-ai ./helm/leadflow-ai \
  -n leadflow-ai \
  -f helm/leadflow-ai/values-prod.yaml \
  --wait \
  --timeout 10m

# 5. Verify deployment
kubectl get pods -n leadflow-ai
kubectl get svc -n leadflow-ai
kubectl get ingress -n leadflow-ai
```

### Option B: CI/CD with GitHub Actions

1. Push code to `main` branch:
   ```bash
   git add .
   git commit -m "Production deployment"
   git push origin main
   ```

2. GitHub Actions will automatically:
   - Build Docker images
   - Push to ghcr.io
   - Deploy to DOKS with Helm
   - Run smoke tests

3. Monitor deployment:
   ```bash
   # Watch GitHub Actions workflow
   # https://github.com/YOUR_ORG/leadflow-ai/actions
   ```

---

## Step 8: Verify Deployment

```bash
# Check pod status
kubectl get pods -n leadflow-ai

# Expected:
# leadflow-ai-backend-xxx (3/3 Running)
# leadflow-ai-notification-xxx (2/2 Running)
# leadflow-ai-followup-xxx (2/2 Running)

# Check services
kubectl get svc -n leadflow-ai

# Test health endpoints
curl https://api.yourdomain.com/health/live
curl https://api.yourdomain.com/health/ready

# Create a test lead
curl -X POST https://api.yourdomain.com/api/v1/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "company": "Test Corp",
    "leadSource": "website"
  }'
```

---

## Step 9: Monitoring Setup

### Prometheus & Grafana

```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
# Login: admin / prom-operator

# Import LeadFlow AI dashboards (see monitoring/grafana/)
```

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/leadflow-ai-backend -n leadflow-ai

# Notification service logs
kubectl logs -f deployment/leadflow-ai-notification -n leadflow-ai

# Follow-up service logs
kubectl logs -f deployment/leadflow-ai-followup -n leadflow-ai
```

---

## Step 10: Scaling

### Horizontal Pod Autoscaling (HPA)

HPA is enabled by default in `values-prod.yaml`:

```yaml
backend:
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
```

Monitor scaling:
```bash
kubectl get hpa -n leadflow-ai
```

### Vertical Scaling (Node Pool)

```bash
# Scale node pool
doctl kubernetes cluster node-pool update leadflow-prod worker-pool \
  --count 5
```

---

## Troubleshooting

### Pods not starting

```bash
# Describe pod for events
kubectl describe pod <pod-name> -n leadflow-ai

# Check logs
kubectl logs <pod-name> -n leadflow-ai
```

### Dapr sidecar issues

```bash
# Check Dapr annotations
kubectl get pod <pod-name> -n leadflow-ai -o yaml | grep dapr

# View Dapr sidecar logs
kubectl logs <pod-name> -c daprd -n leadflow-ai
```

### Database connection errors

```bash
# Test connection from pod
kubectl exec -it <backend-pod> -n leadflow-ai -- sh
apk add postgresql-client
psql $DATABASE_URL
```

### Kafka connection errors

```bash
# Verify Kafka secret
kubectl get secret leadflow-kafka-secret -n leadflow-ai -o yaml

# Check Dapr component
kubectl describe component kafka-pubsub -n leadflow-ai
```

---

## Rollback

```bash
# Rollback to previous release
helm rollback leadflow-ai -n leadflow-ai

# Rollback to specific revision
helm rollback leadflow-ai 2 -n leadflow-ai

# View release history
helm history leadflow-ai -n leadflow-ai
```

---

## Backup & Disaster Recovery

### Database Backups

Neon DB automatically backs up your database. Configure retention:
- Neon Console → Project Settings → Backups
- Recommended: 7-day retention

### Kubernetes Resources

```bash
# Backup all Kubernetes resources
kubectl get all -n leadflow-ai -o yaml > backup-$(date +%Y%m%d).yaml

# Backup secrets (encrypted)
kubectl get secrets -n leadflow-ai -o yaml > secrets-backup-$(date +%Y%m%d).yaml
```

### Disaster Recovery

1. **Database**: Restore from Neon DB backup
2. **Kubernetes**: Redeploy from Helm chart and Git
3. **Secrets**: Restore from secure backup or re-create

**RTO (Recovery Time Objective)**: 1 hour
**RPO (Recovery Point Objective)**: 5 minutes

---

## Security Best Practices

1. **Secrets Management**:
   - Use External Secrets Operator for GitOps
   - Rotate secrets regularly (90 days)

2. **Network Policies**:
   ```bash
   # Enable network policies in values-prod.yaml
   networkPolicy:
     enabled: true
   ```

3. **Pod Security**:
   - Containers run as non-root user (UID 1001)
   - Read-only root filesystem where possible
   - No privilege escalation

4. **TLS/SSL**:
   - All ingress traffic uses HTTPS
   - Internal communication can use mTLS via Dapr

5. **RBAC**:
   - Least privilege service accounts
   - No default service account usage

---

## Cost Optimization

**Current Monthly Cost** (~$161/month):
- DOKS (3 nodes, s-2vcpu-4gb): $72/month
- Managed Redis (db-s-1vcpu-1gb): $15/month
- Load Balancer: $12/month
- Neon DB (serverless): $0-25/month (usage-based)
- Redpanda Cloud (serverless): $0-99/month (free tier available)
- Bandwidth: ~$15/month

**Optimization Tips**:
1. Use Redpanda Cloud free tier (10 GB storage, 100 MB/s)
2. Neon DB auto-scales to zero when idle
3. Enable HPA to scale down during low traffic
4. Use spot instances for non-critical workloads (future)

---

## Support

- **Production Issues**: Create Priority-1 ticket
- **Monitoring**: Grafana dashboards + PagerDuty alerts
- **Logs**: Centralized in DigitalOcean Kubernetes logs

---

**Deployment Checklist**:
- [ ] DOKS cluster provisioned
- [ ] External services configured (Neon, Redis, Redpanda, Anthropic, SendGrid, Twilio)
- [ ] GitHub secrets added
- [ ] DNS configured with SSL/TLS
- [ ] Dapr installed on Kubernetes
- [ ] Helm deployment successful
- [ ] Health checks passing
- [ ] Monitoring dashboards configured
- [ ] Backups verified
- [ ] Documentation updated
