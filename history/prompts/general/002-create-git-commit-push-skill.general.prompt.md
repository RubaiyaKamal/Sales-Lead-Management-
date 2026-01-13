---
id: 002
title: Create Git Commit Push Skill
stage: general
date: 2025-12-31
surface: agent
model: claude-sonnet-4-5
feature: none
branch: main
user: Lap Zone
command: create-skill
labels: ["skill", "git", "version-control", "commit", "push", "workflow"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - .claude/skills/git-commit-push.md
tests:
---

## Prompt

also create skill to push and commit to git

## Response snapshot

Created comprehensive git-commit-push.md skill (9.5K) covering:

1. **Git Status Assessment** - Check current state, view diffs, recent commits
2. **Staging Changes** - Selective staging, interactive staging, review changes
3. **Creating Commits** - Conventional commit format, message templates, examples
4. **Branch Management** - Create, switch, delete branches with naming conventions
5. **Push Operations** - Push to remote, force push safety, remote status checks
6. **Pull and Sync** - Update local branch, rebase vs merge
7. **Merge Conflict Resolution** - Identify, resolve, and continue workflows
8. **Advanced Operations** - Stash, revert, reset, cherry-pick, history viewing
9. **Pre-commit Checks** - Test, lint, format, build verification
10. **Pull Request Creation** - Prepare and create PRs with GitHub CLI

**Commit Message Standards:**
- Conventional commit format (type(scope): subject)
- Types: feat, fix, docs, style, refactor, perf, test, chore, ci, revert
- Breaking changes notation
- Co-author attribution

**Common Workflows:**
- Feature development workflow
- Bug fix workflow
- Hotfix workflow

**Best Practices:**
- 10 git best practices for clean history
- .gitignore essentials
- Security considerations (no secrets)

## Outcome

- ✅ Impact: Created production-ready git skill covering complete version control workflow from staging to PR creation
- 🧪 Tests: No automated tests required for skill definition
- 📁 Files: 1 new skill file created in .claude/skills/
- 🔁 Next prompts: User can invoke skill for git operations (e.g., "Help me commit my changes", "Create a feature branch and push")
- 🧠 Reflection: Skill provides comprehensive git workflow guidance including conventional commits, branch strategies, and GitHub CLI integration

## Evaluation notes (flywheel)

- Failure modes observed: None - file created successfully
- Graders run and results (PASS/FAIL): PASS - Follows established skill pattern, includes comprehensive examples, covers common workflows and edge cases
- Prompt variant (if applicable): N/A
- Next experiment (smallest change to try): Could add GitHub Actions integration examples or GitLab-specific workflows if needed
