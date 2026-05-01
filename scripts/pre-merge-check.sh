#!/bin/bash
# Pre-Merge Verification Script
# Run this on demo branch before merging to main

set -e  # Exit on any error

echo "🔍 Pre-Merge Verification Starting..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "demo" ]; then
    echo -e "${RED}❌ ERROR: You must be on 'demo' branch to run this check${NC}"
    echo "Current branch: $CURRENT_BRANCH"
    echo "Run: git checkout demo"
    exit 1
fi

echo -e "${GREEN}✅ On demo branch${NC}"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  WARNING: You have uncommitted changes${NC}"
    git status --short
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Phase 1: TypeScript Compilation
echo "📦 Phase 1: TypeScript Compilation"
echo "Running: npm run build"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript compilation passed${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    echo "Fix compilation errors before merging"
    exit 1
fi
echo ""

# Phase 2: Prisma Client
echo "🔧 Phase 2: Prisma Client"
echo "Running: npx prisma generate"
if npx prisma generate > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Prisma client generated successfully${NC}"
else
    echo -e "${RED}❌ Prisma client generation failed${NC}"
    exit 1
fi
echo ""

# Phase 3: Test Suite
echo "🧪 Phase 3: Test Suite"
echo "Running: npm test"
if npm test; then
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    echo "Fix failing tests before merging"
    exit 1
fi
echo ""

# Phase 4: Frontend Build
echo "🎨 Phase 4: Frontend Build"
cd frontend
echo "Running: npm run build"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    cd ..
    exit 1
fi
cd ..
echo ""

# Phase 5: Security Scan (basic)
echo "🔒 Phase 5: Security Check"
echo "Checking for accidentally committed secrets..."

# Check for common secret patterns in diff
SECRETS_FOUND=0
if git diff main..demo | grep -iE "(secret|password|api_key|token).*=.*['\"]" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  WARNING: Potential secrets found in code${NC}"
    echo "Review these lines carefully:"
    git diff main..demo | grep -iE "(secret|password|api_key|token).*=.*['\"]"
    SECRETS_FOUND=1
else
    echo -e "${GREEN}✅ No obvious secrets in code${NC}"
fi
echo ""

# Phase 6: Database Migration Check
echo "🗄️  Phase 6: Database Migration Check"
if git diff main..demo --name-only | grep "prisma/migrations" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  New database migrations detected:${NC}"
    git diff main..demo --name-only | grep "prisma/migrations"
    echo ""
    echo "Make sure you have:"
    echo "  1. Tested migrations locally"
    echo "  2. Documented rollback procedure"
    echo "  3. Verified no breaking changes"
else
    echo -e "${GREEN}✅ No database migrations${NC}"
fi
echo ""

# Phase 7: Changes Summary
echo "📋 Phase 7: Changes Summary"
CHANGES=$(git diff main..demo --shortstat)
FILES_CHANGED=$(git diff main..demo --name-only | wc -l)
echo "Files changed: $FILES_CHANGED"
echo "$CHANGES"
echo ""
echo "Modified files:"
git diff main..demo --name-only | head -20
if [ "$FILES_CHANGED" -gt 20 ]; then
    echo "... and $((FILES_CHANGED - 20)) more files"
fi
echo ""

# Final Summary
echo "========================================="
echo "📊 PRE-MERGE VERIFICATION SUMMARY"
echo "========================================="
echo ""

if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All automated checks passed!${NC}"
    echo ""
    echo "Manual checks still required:"
    echo "  [ ] Test deposit flow with Stripe test card"
    echo "  [ ] Test concurrent reservations"
    echo "  [ ] Test admin operations"
    echo "  [ ] Verify email delivery"
    echo "  [ ] Check health endpoint"
    echo ""
    echo "See MERGE_TO_PRODUCTION.md for complete checklist"
    echo ""
    echo -e "${GREEN}Ready to merge? Run:${NC}"
    echo "  git checkout main"
    echo "  git merge demo"
    echo "  git push origin main"
else
    echo -e "${YELLOW}⚠️  Checks passed with warnings${NC}"
    echo ""
    echo "Please review:"
    echo "  - Potential secrets in code"
    echo ""
    echo "See output above for details"
fi

echo ""
echo "========================================="
