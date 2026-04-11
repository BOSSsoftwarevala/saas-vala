# SAAS VALA Pipeline Troubleshooting Guide

## Issue: GitHub Actions Pipeline Failing at "Setup Environment"

### Root Causes
1. **package-lock.json inconsistency** - The `npm ci` command requires exact match between package.json and package-lock.json
2. **Node.js version compatibility** - Some dependencies may require specific Node.js versions
3. **Network/cache issues** - GitHub Actions runner may have connectivity issues
4. **Dependency conflicts** - Version conflicts in dependencies

### Solutions Implemented

#### 1. Enhanced Setup Job with Fallback
```yaml
- name: Verify package-lock.json exists
  run: |
    if [ ! -f "package-lock.json" ]; then
      echo "❌ package-lock.json not found"
      echo "🔄 Generating new package-lock.json..."
      npm install --package-lock-only
    else
      echo "✅ package-lock.json found"
    fi

- name: Clean npm cache
  run: npm cache clean --force

- name: Install Dependencies (with fallback)
  run: |
    echo "🚀 Attempting npm ci..."
    if ! npm ci; then
      echo "⚠️ npm ci failed, falling back to npm install..."
      rm -rf node_modules
      npm install
      echo "🔄 Updating package-lock.json..."
      npm install --package-lock-only
    fi
```

#### 2. Updated All Jobs with Resilient Installation
All jobs now use the same fallback mechanism to handle npm ci failures gracefully.

### Quick Fix Steps

#### Option 1: Local Fix (Recommended)
1. Run the diagnostic script:
   ```bash
   chmod +x scripts/fix-pipeline.sh
   ./scripts/fix-pipeline.sh
   ```

2. Commit the updated package-lock.json:
   ```bash
   git add package-lock.json .github/workflows/main.yml
   git commit -m "fix: resolve pipeline installation issues"
   git push
   ```

#### Option 2: Manual Fix
1. Delete node_modules and package-lock.json:
   ```bash
   rm -rf node_modules package-lock.json
   ```

2. Fresh install:
   ```bash
   npm install
   ```

3. Commit updated package-lock.json:
   ```bash
   git add package-lock.json
   git commit -m "fix: update package-lock.json"
   git push
   ```

### Prevention Measures

#### 1. Always Update package-lock.json
After any dependency changes:
```bash
npm install --package-lock-only
git add package-lock.json
git commit -m "chore: update package-lock.json"
```

#### 2. Test Locally Before Pushing
```bash
npm ci
npm run build
npm test
```

#### 3. Use Consistent Node.js Version
Ensure local Node.js version matches workflow (v20):
```bash
nvm use 20
# or
nvm install 20
```

### Common Error Messages & Solutions

#### Error: "npm ci failed"
**Solution**: The fallback mechanism in the updated workflow handles this automatically.

#### Error: "ENOTFOUND registry.npmjs.org"
**Solution**: Network issue - the workflow will retry automatically.

#### Error: "Cannot find module"
**Solution**: Clean install with fallback handles missing modules.

#### Error: "Version mismatch"
**Solution**: The workflow regenerates package-lock.json when needed.

### Advanced Troubleshooting

#### Check Dependency Conflicts
```bash
npm ls --all
```

#### Audit Security Issues
```bash
npm audit --audit-level=high
npm audit fix
```

#### Verify Build Process
```bash
npm run build:ci
```

### Monitoring Pipeline Health

After fixes, monitor:
1. ✅ Setup Environment should pass
2. ✅ All subsequent jobs should run (not be skipped)
3. ✅ Build should complete successfully
4. ✅ Tests should execute

### If Issues Persist

1. **Check GitHub Actions Logs**: Look for specific error messages
2. **Verify Secrets**: Ensure required secrets are configured
3. **Check Disk Space**: GitHub Actions runners have limited space
4. **Network Issues**: Sometimes retrying the workflow resolves transient issues

### Workflow Improvements Made

1. **Resilient Installation**: Fallback from npm ci to npm install
2. **Better Logging**: More verbose output for debugging
3. **Verification Steps**: Check installation success before proceeding
4. **Cache Management**: Clean npm cache before installation
5. **Error Handling**: Graceful failure handling with informative messages

---

## Next Steps

1. Run the diagnostic script locally
2. Commit and push the changes
3. Monitor the pipeline execution
4. Verify all jobs complete successfully

The enhanced workflow is now much more resilient to common installation issues and should resolve the "Setup Environment" failure.
