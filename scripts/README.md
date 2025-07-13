# IoT Sensor Aggregator - Scripts

This directory contains utility scripts for deployment, testing, and Git operations.

## 📁 Available Scripts

### 🚀 **Deployment Scripts**
- **`deploy.sh`** - Deploy the CDK stack to AWS
- **`test-api.sh`** - Test API endpoints after deployment
- **`query-data.sh`** - Query sensor data and aggregates
- **`monitor.sh`** - Monitor system health and metrics

### 🧪 **Testing Scripts**
- **`run-tests.sh`** - Comprehensive test runner with multiple options

### 📝 **Git Scripts**
- **`git-commit-separately.sh`** - Advanced Git script with many features
- **`git-commit-simple.sh`** - Simple Git script for basic use cases

---

## 📝 Git Scripts Usage

### **Simple Git Script** (`git-commit-simple.sh`)

**Purpose**: Quickly commit each modified file separately with minimal configuration.

```bash
# Basic usage - commits all files with "Update" prefix
./scripts/git-commit-simple.sh

# Custom commit message prefix
./scripts/git-commit-simple.sh "feat: add"

# Examples of generated commit messages:
# "Update package.json"
# "feat: add ingest-service.test.ts"
# "Update README.md"
```

**What it does**:
1. ✅ Finds all modified, staged, and untracked files
2. ✅ Commits each file individually with descriptive messages
3. ✅ Pushes all commits to the current branch
4. ✅ Shows recent commit history

---

### **Advanced Git Script** (`git-commit-separately.sh`)

**Purpose**: Full-featured Git script with intelligent commit messages, dry-run mode, and interactive options.

#### **Basic Usage**
```bash
# Default behavior - commit all files
./scripts/git-commit-separately.sh

# Custom message prefix
./scripts/git-commit-separately.sh -m "feat: implement"

# Dry run to see what would be committed
./scripts/git-commit-separately.sh -n

# Interactive mode - confirm each commit
./scripts/git-commit-separately.sh -i
```

#### **Advanced Options**
```bash
# Full option example
./scripts/git-commit-separately.sh \
  --message "fix: update" \
  --branch main \
  --interactive

# Help
./scripts/git-commit-separately.sh --help
```

#### **Command Line Options**

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--message` | `-m` | Commit message prefix | `-m "feat: add"` |
| `--branch` | `-b` | Target branch to push | `-b main` |
| `--dry-run` | `-n` | Show what would be committed | `-n` |
| `--interactive` | `-i` | Confirm each commit | `-i` |
| `--help` | `-h` | Show help message | `-h` |

#### **Intelligent Commit Messages**

The advanced script generates contextual commit messages based on file location:

| File Location | Example Message |
|---------------|-----------------|
| `lambda/ingest/index.ts` | `Update Lambda function: index.ts` |
| `lib/stack.ts` | `Update CDK stack: stack.ts` |
| `test/unit/service.test.ts` | `Update test: service.test.ts` |
| `scripts/deploy.sh` | `Update script: deploy.sh` |
| `package.json` | `Update dependencies in package.json` |
| `README.md` | `Update project documentation` |

#### **File Status Indicators**

The script shows visual indicators for file status:

| Symbol | Status | Description |
|--------|--------|-------------|
| ➕ | Added | New file |
| 📝 | Modified | Changed file |
| 🗑️ | Deleted | Removed file |
| 🔄 | Renamed | Renamed file |
| 📋 | Copied | Copied file |

---

## 🎯 **Use Cases**

### **When to Use Simple Script**
- ✅ Quick commits during development
- ✅ Simple workflow with standard messages
- ✅ When you want minimal interaction
- ✅ Batch committing multiple files quickly

### **When to Use Advanced Script**
- ✅ Professional commit history with detailed messages
- ✅ Code reviews requiring clear commit separation
- ✅ When you want to preview commits first (dry-run)
- ✅ Interactive workflow with confirmation
- ✅ Custom branching strategies

---

## 📋 **Examples**

### **Scenario 1: Quick Development Commits**
```bash
# After making changes to multiple files
./scripts/git-commit-simple.sh "fix: update"

# Result:
# - fix: update package.json
# - fix: update ingest-service.ts
# - fix: update README.md
```

### **Scenario 2: Feature Branch with Review**
```bash
# Preview what will be committed
./scripts/git-commit-separately.sh -n -m "feat: implement sensor validation"

# If satisfied, commit interactively
./scripts/git-commit-separately.sh -i -m "feat: implement sensor validation"

# Push to feature branch
./scripts/git-commit-separately.sh -m "feat: implement sensor validation" -b feature/sensor-validation
```

### **Scenario 3: Clean Up Before PR**
```bash
# Interactive mode to selectively commit files
./scripts/git-commit-separately.sh -i -m "refactor: clean up"

# Result: Clean commit history with each file change isolated
```

---

## 🔧 **Prerequisites**

### **Git Configuration**
Ensure Git is properly configured:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### **Remote Repository**
Make sure you have a remote repository configured:
```bash
git remote -v
# Should show origin with your repository URL
```

### **Branch Setup**
Ensure you're on the correct branch:
```bash
git branch --show-current
git status
```

---

## ⚠️ **Important Notes**

### **Before Running Scripts**
1. **Review Changes**: Always review your changes before committing
2. **Test Your Code**: Ensure tests pass (`npm test`)
3. **Check Branch**: Verify you're on the correct branch
4. **Pull Latest**: Pull latest changes if working with others

### **Best Practices**
1. **Use Dry Run**: Always use `-n` flag first to preview
2. **Meaningful Prefixes**: Use conventional commit prefixes:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for tests
   - `refactor:` for refactoring
   - `chore:` for maintenance

3. **Interactive Mode**: Use `-i` for important commits
4. **Branch Strategy**: Use `-b` to specify target branch

### **Troubleshooting**

#### **Script Permission Denied**
```bash
chmod +x scripts/git-commit-separately.sh
chmod +x scripts/git-commit-simple.sh
```

#### **Git Push Fails**
```bash
# Pull latest changes first
git pull origin main

# Then run the script again
./scripts/git-commit-separately.sh
```

#### **Too Many Commits**
If you accidentally create too many commits, you can squash them:
```bash
# Interactive rebase to squash last N commits
git rebase -i HEAD~N

# Or reset and recommit
git reset --soft HEAD~N
git commit -m "Combined commit message"
```

---

## 🎉 **Examples in Action**

### **Complete Workflow Example**
```bash
# 1. Make your changes
vim lambda/ingest/service.ts
vim test/unit/ingest-service.test.ts
vim README.md

# 2. Preview what will be committed
./scripts/git-commit-separately.sh -n -m "feat: enhance sensor validation"

# 3. Commit interactively
./scripts/git-commit-separately.sh -i -m "feat: enhance sensor validation"

# 4. Result: Clean commit history
# - feat: enhance sensor validation Lambda function: service.ts
# - feat: enhance sensor validation test: ingest-service.test.ts  
# - feat: enhance sensor validation project documentation
```

This creates a clean, professional commit history that's easy to review and understand! 🚀
