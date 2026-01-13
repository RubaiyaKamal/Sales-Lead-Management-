---
description: Expert assistance with git commits, pushes, branching, and version control workflows
---

# SKILL: Git Commit and Push

## CONTEXT

The user needs help with git version control operations including:

- Staging and committing changes
- Writing effective commit messages
- Pushing changes to remote repositories
- Branch management (create, switch, merge)
- Handling merge conflicts
- Git best practices and workflows
- Pull requests and code review preparation

**User's specific request:**

$ARGUMENTS

## YOUR ROLE

Act as a git expert with knowledge in:

- Git workflow best practices
- Conventional commit message standards
- Branch management strategies
- Merge conflict resolution
- Git history management
- Remote repository operations
- GitHub/GitLab workflows

## OUTPUT STRUCTURE

### Step 1: Assess Current State

Check the current git status:
```bash
# View current status
git status

# View unstaged changes
git diff

# View staged changes
git diff --cached

# View recent commits
git log --oneline -5
```

Clarify with user:
- What changes need to be committed?
- Is this a new feature, bug fix, or other type of change?
- Which branch should changes go to?
- Are there any uncommitted changes that should be excluded?

### Step 2: Stage Changes

**Stage specific files:**
```bash
# Stage specific files
git add path/to/file1.js path/to/file2.ts

# Stage all files in a directory
git add src/

# Stage all modified files
git add -u

# Stage all files (including new files)
git add .

# Interactive staging
git add -p
```

**Review staged changes:**
```bash
# See what will be committed
git diff --cached

# See file names that will be committed
git status
```

### Step 3: Create Commit

**Conventional Commit Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling
- `ci`: CI/CD changes
- `revert`: Revert previous commit

**Commit with message:**
```bash
# Simple commit
git commit -m "feat: add user authentication"

# Commit with body
git commit -m "feat: add user authentication" -m "Implemented JWT-based authentication with refresh tokens. Added login and logout endpoints."

# Commit using editor (for detailed messages)
git commit

# Amend last commit (use cautiously)
git commit --amend

# Commit with co-author
git commit -m "feat: add payment integration

Co-authored-by: John Doe <john@example.com>"
```

**Example Commit Messages:**

```bash
# Feature
git commit -m "feat(auth): implement JWT authentication with refresh tokens"

# Bug fix
git commit -m "fix(api): resolve null pointer exception in user service"

# Documentation
git commit -m "docs(readme): add installation instructions for Docker setup"

# Refactoring
git commit -m "refactor(database): extract query builder to separate module"

# Performance
git commit -m "perf(api): optimize database queries with indexes"

# Breaking change
git commit -m "feat(api)!: change authentication endpoint structure

BREAKING CHANGE: /auth/login endpoint now requires email instead of username"
```

### Step 4: Branch Management

**Create and switch branches:**
```bash
# Create new branch
git branch feature/user-profile

# Switch to branch
git checkout feature/user-profile

# Create and switch in one command
git checkout -b feature/user-profile

# Modern way (Git 2.23+)
git switch -c feature/user-profile

# List all branches
git branch -a

# Delete local branch
git branch -d feature/user-profile

# Force delete local branch
git branch -D feature/user-profile
```

**Branch naming conventions:**
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `hotfix/critical-fix` - Critical production fixes
- `refactor/component-name` - Refactoring
- `docs/documentation-topic` - Documentation
- `test/test-description` - Test additions

### Step 5: Push to Remote

**Push changes:**
```bash
# Push to remote (first time for new branch)
git push -u origin feature/user-profile

# Push to remote (subsequent pushes)
git push

# Push current branch
git push origin HEAD

# Force push (use with extreme caution!)
git push --force-with-lease

# Push all branches
git push --all

# Push tags
git push --tags
```

**Check remote status:**
```bash
# View remote repositories
git remote -v

# Fetch remote changes without merging
git fetch origin

# See difference with remote
git diff origin/main

# View remote branches
git branch -r
```

### Step 6: Pull and Sync

**Update local branch:**
```bash
# Pull and merge
git pull origin main

# Pull and rebase
git pull --rebase origin main

# Fetch without merging
git fetch origin

# Merge specific branch
git merge origin/main
```

### Step 7: Handle Merge Conflicts

**When conflicts occur:**
```bash
# See conflicted files
git status

# View conflict in file
cat path/to/conflicted/file

# After resolving conflicts manually
git add path/to/resolved/file

# Continue merge/rebase
git merge --continue
# or
git rebase --continue

# Abort merge/rebase
git merge --abort
# or
git rebase --abort

# Use merge tool
git mergetool
```

### Step 8: Advanced Operations

**Stash changes:**
```bash
# Stash current changes
git stash

# Stash with message
git stash save "WIP: working on feature X"

# List stashes
git stash list

# Apply latest stash
git stash apply

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{1}

# Drop stash
git stash drop stash@{0}
```

**Revert and reset:**
```bash
# Revert a commit (creates new commit)
git revert <commit-hash>

# Reset to previous commit (keep changes)
git reset --soft HEAD~1

# Reset to previous commit (discard changes)
git reset --hard HEAD~1

# Unstage file
git reset HEAD path/to/file
```

**Cherry-pick:**
```bash
# Apply specific commit from another branch
git cherry-pick <commit-hash>
```

**View history:**
```bash
# Detailed log
git log

# Condensed log
git log --oneline

# Graphical log
git log --graph --oneline --all

# Log with stats
git log --stat

# Search commits
git log --grep="keyword"

# Log for specific file
git log path/to/file

# Who changed what
git blame path/to/file
```

### Step 9: Pre-commit Checks

Before committing, verify:

```bash
# Run tests
npm test
# or
pytest
# or
cargo test

# Run linter
npm run lint
# or
eslint .
# or
flake8 .

# Check formatting
npm run format:check
# or
black --check .
# or
cargo fmt -- --check

# Build project
npm run build
# or
cargo build
```

### Step 10: Create Pull Request

**Prepare for PR:**
```bash
# Ensure branch is up to date
git fetch origin
git rebase origin/main

# Push branch
git push -u origin feature/user-profile

# Using GitHub CLI
gh pr create --title "feat: add user profile page" \
  --body "Implements user profile with avatar upload and bio editing" \
  --base main \
  --head feature/user-profile

# View PR
gh pr view

# List PRs
gh pr list
```

## COMMON WORKFLOWS

### Workflow 1: Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: implement new feature"

# 3. Keep branch updated
git fetch origin
git rebase origin/main

# 4. Push to remote
git push -u origin feature/new-feature

# 5. Create PR (via GitHub UI or CLI)
gh pr create
```

### Workflow 2: Bug Fix
```bash
# 1. Create fix branch
git checkout -b fix/bug-description

# 2. Fix and commit
git add .
git commit -m "fix: resolve issue with login timeout"

# 3. Push and create PR
git push -u origin fix/bug-description
gh pr create
```

### Workflow 3: Hotfix
```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Fix and commit
git add .
git commit -m "fix: patch critical security vulnerability"

# 3. Push and create urgent PR
git push -u origin hotfix/critical-security-fix
gh pr create --label "urgent"
```

## BEST PRACTICES

1. **Commit Often**: Make small, focused commits
2. **Write Clear Messages**: Follow conventional commit format
3. **Test Before Commit**: Ensure code works before committing
4. **Review Before Push**: Check `git diff` and `git status`
5. **Keep Commits Atomic**: One logical change per commit
6. **Don't Commit Secrets**: Use .gitignore for sensitive files
7. **Rebase vs Merge**: Use rebase for clean history, merge for collaboration
8. **Force Push Carefully**: Only on your own branches, never on shared branches
9. **Pull Before Push**: Always sync before pushing
10. **Use Branches**: Never commit directly to main/master

## .gitignore Essentials

```gitignore
# Dependencies
node_modules/
venv/
target/

# Environment variables
.env
.env.local
*.env

# IDE
.vscode/
.idea/
*.swp

# Build outputs
dist/
build/
*.log

# OS files
.DS_Store
Thumbs.db

# Secrets
secrets.json
credentials.json
*.pem
*.key
```

## ACCEPTANCE CRITERIA

- Changes are staged and committed with clear, conventional commit messages
- No secrets or sensitive data committed
- Tests pass before committing
- Branch naming follows conventions
- Changes pushed to appropriate remote branch
- PR created with clear title and description (if applicable)
- No merge conflicts
- Git history is clean and logical
- .gitignore properly configured to exclude unnecessary files
