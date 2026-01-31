# Branching Strategy

This document outlines the branching strategy for the Breakpoint project to ensure smooth collaboration and prevent conflicts.

## Branch Structure

### Main Branch
- **`main`** - Production-ready code
- Protected branch (no direct commits)
- All changes must come through pull requests
- Always deployable

### Development Branches

#### Feature Branches
Create a new branch for each feature or task:

```bash
git checkout -b feature/your-feature-name
```

**Naming Convention:**
- `feature/user-authentication`
- `feature/dashboard-ui`
- `feature/payment-integration`

#### Bug Fix Branches
For bug fixes:

```bash
git checkout -b fix/issue-description
```

**Examples:**
- `fix/login-error`
- `fix/null-pointer-exception`

#### Hotfix Branches
For urgent production fixes:

```bash
git checkout -b hotfix/critical-issue
```

**Examples:**
- `hotfix/security-patch`
- `hotfix/payment-failure`

#### Documentation Branches
For documentation updates:

```bash
git checkout -b docs/what-you-are-documenting
```

**Examples:**
- `docs/api-endpoints`
- `docs/setup-instructions`

## Workflow

### 1. Create Your Branch

Always branch from the latest `main`:

```bash
# Make sure you're on main
git checkout main

# Pull the latest changes
git pull origin main

# Create your feature branch
git checkout -b feature/your-feature-name
```

### 2. Work on Your Branch

Make commits to your branch:

```bash
# Make changes to files
git add .
git commit -m "Descriptive commit message"
```

### 3. Keep Your Branch Updated

Regularly sync with `main` to avoid conflicts:

```bash
# Fetch latest changes
git fetch origin

# Merge main into your branch
git merge origin/main
```

Or use rebase for a cleaner history:

```bash
git rebase origin/main
```

### 4. Push Your Branch

Push your branch to the remote repository:

```bash
git push -u origin feature/your-feature-name
```

### 5. Create a Pull Request

1. Go to GitHub repository
2. Click "Pull requests" → "New pull request"
3. Select your branch to merge into `main`
4. Add a clear title and description
5. Request reviewers
6. Link any related issues

### 6. Code Review

- At least one team member should review your code
- Address feedback and push updates
- Once approved, the branch can be merged

### 7. Merge and Cleanup

After merging:

```bash
# Switch back to main
git checkout main

# Pull the latest (including your merged changes)
git pull origin main

# Delete your local branch
git branch -d feature/your-feature-name

# Delete remote branch (if not auto-deleted)
git push origin --delete feature/your-feature-name
```

## Best Practices

### ✅ Do's

- **Create a new branch for each feature/fix**
- **Use descriptive branch names**
- **Keep branches short-lived** (merge frequently)
- **Commit often with clear messages**
- **Pull from main regularly** to stay updated
- **Test your code** before creating a PR
- **Review others' pull requests** promptly

### ❌ Don'ts

- **Don't commit directly to `main`**
- **Don't work on multiple unrelated features in one branch**
- **Don't let branches become stale** (sync with main often)
- **Don't push broken code**
- **Don't merge your own pull requests** without review
- **Don't delete branches with unmerged work**

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: Add user login functionality
fix: Resolve null pointer in payment processing
docs: Update API documentation
refactor: Simplify authentication logic
test: Add unit tests for user service
chore: Update dependencies
```

## Common Commands Quick Reference

```bash
# Check current branch
git branch

# Switch to existing branch
git checkout branch-name

# Create and switch to new branch
git checkout -b branch-name

# View all branches (local and remote)
git branch -a

# Delete local branch
git branch -d branch-name

# Pull latest from main
git pull origin main

# Push your branch
git push origin branch-name

# View status
git status

# View commit history
git log --oneline
```

## Merge Conflicts

If you encounter merge conflicts:

1. Pull the latest changes from main
2. Git will mark conflicting files
3. Open conflicting files and resolve conflicts manually
4. Remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
5. Stage the resolved files: `git add .`
6. Complete the merge: `git commit`
7. Push your changes

## Questions?

If you're unsure about any part of this workflow, ask the team lead or refer to this document.

---

**Remember:** The goal is to keep `main` stable and production-ready at all times. Always work on feature branches and use pull requests for code review and collaboration.
