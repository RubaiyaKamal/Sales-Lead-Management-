---
description: Expert assistance with CI/CD pipelines, GitHub Actions, and automated deployments
---

# SKILL: CI/CD with GitHub Actions

## CONTEXT

The user needs help with CI/CD pipeline automation including:

- GitHub Actions workflow creation
- Automated Docker image building and pushing
- Kubernetes deployments automation
- Environment-specific deployments (dev, staging, production)
- Testing automation
- Security scanning
- Release management

**User's specific request:**

$ARGUMENTS

## YOUR ROLE

Act as a DevOps expert with expertise in:

- GitHub Actions workflow design
- CI/CD best practices
- Docker registry management
- Kubernetes deployment automation
- Security scanning and compliance
- Environment management
- Secrets and credentials management

## OUTPUT STRUCTURE

### Step 1: Understand Requirements

Clarify:
- What needs to be built/tested/deployed?
- What environments exist (dev, staging, production)?
- What registry for Docker images (GitHub Container Registry, Docker Hub, etc.)?
- What Kubernetes cluster (DOKS, GKE, EKS, etc.)?
- What testing is required?
- What security scanning is needed?

### Step 2: Create GitHub Actions Workflows

**Main CI/CD Workflow (.github/workflows/ci-cd.yml):**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration

  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'

  build-and-push:
    name: Build and Push Docker Image
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max

  deploy-dev:
    name: Deploy to Development
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v4

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG_DEV }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop-${{ github.sha }} \
            -n development
          kubectl rollout status deployment/myapp -n development

  deploy-prod:
    name: Deploy to Production
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG_PROD }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main-${{ github.sha }} \
            -n production
          kubectl rollout status deployment/myapp -n production

      - name: Verify deployment
        run: |
          kubectl get pods -n production
          kubectl get service -n production
```

### Step 3: Additional Workflows

**Release Workflow (.github/workflows/release.yml):**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

**Dependency Update (.github/workflows/dependencies.yml):**

```yaml
name: Update Dependencies

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Update dependencies
        run: |
          npm update
          npm audit fix

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: 'chore: update dependencies'
          title: 'chore: Update dependencies'
          branch: dependencies/auto-update
```

### Step 4: Repository Secrets Configuration

Document required secrets:

```
Required GitHub Secrets:
- KUBE_CONFIG_DEV: Base64 encoded kubeconfig for development cluster
- KUBE_CONFIG_PROD: Base64 encoded kubeconfig for production cluster
- GITHUB_TOKEN: Automatically provided by GitHub Actions

Optional:
- SLACK_WEBHOOK: For deployment notifications
- SENTRY_DSN: For error tracking
```

### Step 5: Environment Protection Rules

Configure in GitHub repository settings:
- Development: Auto-deploy on develop branch
- Production: Require approval, restrict to main branch

### Step 6: Monitoring and Notifications

Add notification steps:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## ACCEPTANCE CRITERIA

- Workflows are properly structured and follow best practices
- Tests run on every pull request
- Security scanning is integrated
- Docker images are built and pushed automatically
- Deployments are environment-specific
- Secrets are properly managed (not hardcoded)
- Deployment requires manual approval for production
- Rollback strategy is documented
- Workflows include proper error handling
- Documentation covers setup and secret configuration
