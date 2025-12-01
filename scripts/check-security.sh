#!/bin/bash

# Security Check Script for MedGuidence AI
# Run this before pushing to GitHub

echo "🔒 Running Security Checks..."
echo ""

# Check 1: Verify .env.local is not tracked
echo "✓ Checking if .env.local is ignored..."
if git ls-files | grep -q ".env.local"; then
    echo "❌ ERROR: .env.local is tracked by git!"
    echo "   Run: git rm --cached .env.local"
    exit 1
else
    echo "✅ .env.local is properly ignored"
fi

# Check 2: Search for Gemini API keys
echo ""
echo "✓ Checking for Gemini API keys..."
if git grep -q "AIzaSy" 2>/dev/null; then
    echo "❌ ERROR: Gemini API key found in tracked files!"
    git grep "AIzaSy"
    exit 1
else
    echo "✅ No Gemini API keys found"
fi

# Check 3: Search for Perplexity API keys
echo ""
echo "✓ Checking for Perplexity API keys..."
if git grep -q "pplx-" 2>/dev/null; then
    echo "❌ ERROR: Perplexity API key found in tracked files!"
    git grep "pplx-"
    exit 1
else
    echo "✅ No Perplexity API keys found"
fi

# Check 4: Search for generic API key patterns
echo ""
echo "✓ Checking for generic API key patterns..."
if git grep -iE "(api[_-]?key|secret[_-]?key|access[_-]?key).*=.*['\"][a-zA-Z0-9]{20,}['\"]" 2>/dev/null; then
    echo "⚠️  WARNING: Potential API keys found. Please review:"
    git grep -iE "(api[_-]?key|secret[_-]?key|access[_-]?key).*=.*['\"][a-zA-Z0-9]{20,}['\"]"
else
    echo "✅ No generic API key patterns found"
fi

# Check 5: Verify .env.local.example has no real keys
echo ""
echo "✓ Checking .env.local.example..."
if grep -qE "AIzaSy|pplx-|sk-" .env.local.example 2>/dev/null; then
    echo "❌ ERROR: Real API keys found in .env.local.example!"
    exit 1
else
    echo "✅ .env.local.example is clean"
fi

# Check 6: Verify LICENSE file exists
echo ""
echo "✓ Checking for LICENSE file..."
if [ -f "LICENSE" ]; then
    echo "✅ LICENSE file exists"
else
    echo "❌ ERROR: LICENSE file missing!"
    exit 1
fi

# Check 7: Verify .kiro directory exists
echo ""
echo "✓ Checking for .kiro directory..."
if [ -d ".kiro" ]; then
    echo "✅ .kiro directory exists"
else
    echo "⚠️  WARNING: .kiro directory missing (required for hackathon)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Security checks passed!"
echo "✅ Safe to push to GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
