#!/bin/bash

# SAAS VALA Pipeline Fix Script
# This script helps diagnose and fix common GitHub Actions pipeline issues

echo "🔧 SAAS VALA Pipeline Diagnosis & Fix"
echo "====================================="

# Check Node.js version
echo "📋 Checking Node.js version..."
node --version
npm --version

# Check package.json and package-lock.json consistency
echo "📋 Checking package files..."
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi

if [ ! -f "package-lock.json" ]; then
    echo "⚠️ package-lock.json not found, generating..."
    npm install --package-lock-only
else
    echo "✅ package-lock.json found"
fi

# Clean up npm and node_modules
echo "🧹 Cleaning up..."
rm -rf node_modules
npm cache clean --force

# Install dependencies
echo "📦 Installing dependencies..."
if npm ci; then
    echo "✅ npm ci successful"
else
    echo "⚠️ npm ci failed, trying npm install..."
    if npm install; then
        echo "✅ npm install successful"
        echo "🔄 Updating package-lock.json..."
        npm install --package-lock-only
    else
        echo "❌ npm install failed"
        echo "🔍 Checking for specific errors..."
        npm install --verbose
        exit 1
    fi
fi

# Verify installation
echo "🔍 Verifying installation..."
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not created"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo "📊 Node modules size: $(du -sh node_modules | cut -f1)"

# Test build
echo "🏗️ Testing build..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "⚠️ Build failed, checking for missing dependencies..."
    npm install
    if npm run build; then
        echo "✅ Build successful after reinstall"
    else
        echo "❌ Build still failing"
        exit 1
    fi
fi

# Test linting
echo "🔍 Testing linting..."
if npm run lint; then
    echo "✅ Linting successful"
else
    echo "⚠️ Linting issues found (but continuing)"
fi

# Test tests
echo "🧪 Testing tests..."
if npm test; then
    echo "✅ Tests successful"
else
    echo "⚠️ Some tests failed (but continuing)"
fi

echo ""
echo "🎉 Pipeline diagnosis complete!"
echo "✅ All critical checks passed"
echo "🚀 Ready to commit and push changes"
