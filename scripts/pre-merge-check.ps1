# Pre-Merge Verification Script (PowerShell)
# Run this on demo branch before merging to main

$ErrorActionPreference = "Stop"

Write-Host "🔍 Pre-Merge Verification Starting..." -ForegroundColor Cyan
Write-Host ""

# Check current branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "demo") {
    Write-Host "❌ ERROR: You must be on 'demo' branch to run this check" -ForegroundColor Red
    Write-Host "Current branch: $currentBranch"
    Write-Host "Run: git checkout demo"
    exit 1
}

Write-Host "✅ On demo branch" -ForegroundColor Green
Write-Host ""

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  WARNING: You have uncommitted changes" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
}

# Phase 1: TypeScript Compilation
Write-Host "📦 Phase 1: TypeScript Compilation" -ForegroundColor Cyan
Write-Host "Running: npm run build"
try {
    npm run build 2>&1 | Out-Null
    Write-Host "✅ TypeScript compilation passed" -ForegroundColor Green
} catch {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    Write-Host "Fix compilation errors before merging"
    exit 1
}
Write-Host ""

# Phase 2: Prisma Client
Write-Host "🔧 Phase 2: Prisma Client" -ForegroundColor Cyan
Write-Host "Running: npx prisma generate"
try {
    npx prisma generate 2>&1 | Out-Null
    Write-Host "✅ Prisma client generated successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Prisma client generation failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Phase 3: Test Suite
Write-Host "🧪 Phase 3: Test Suite" -ForegroundColor Cyan
Write-Host "Running: npm test"
try {
    npm test
    Write-Host "✅ All tests passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Tests failed" -ForegroundColor Red
    Write-Host "Fix failing tests before merging"
    exit 1
}
Write-Host ""

# Phase 4: Frontend Build
Write-Host "🎨 Phase 4: Frontend Build" -ForegroundColor Cyan
Push-Location frontend
Write-Host "Running: npm run build"
try {
    npm run build 2>&1 | Out-Null
    Write-Host "✅ Frontend build successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Phase 5: Security Scan (basic)
Write-Host "🔒 Phase 5: Security Check" -ForegroundColor Cyan
Write-Host "Checking for accidentally committed secrets..."

$secretsFound = $false
$diff = git diff main..demo
if ($diff -match "(?i)(secret|password|api_key|token).*=.*['\`"]") {
    Write-Host "⚠️  WARNING: Potential secrets found in code" -ForegroundColor Yellow
    Write-Host "Review these lines carefully:"
    git diff main..demo | Select-String -Pattern "(?i)(secret|password|api_key|token).*=.*['\`"]"
    $secretsFound = $true
} else {
    Write-Host "✅ No obvious secrets in code" -ForegroundColor Green
}
Write-Host ""

# Phase 6: Database Migration Check
Write-Host "🗄️  Phase 6: Database Migration Check" -ForegroundColor Cyan
$migrations = git diff main..demo --name-only | Select-String "prisma/migrations"
if ($migrations) {
    Write-Host "⚠️  New database migrations detected:" -ForegroundColor Yellow
    $migrations
    Write-Host ""
    Write-Host "Make sure you have:"
    Write-Host "  1. Tested migrations locally"
    Write-Host "  2. Documented rollback procedure"
    Write-Host "  3. Verified no breaking changes"
} else {
    Write-Host "✅ No database migrations" -ForegroundColor Green
}
Write-Host ""

# Phase 7: Changes Summary
Write-Host "📋 Phase 7: Changes Summary" -ForegroundColor Cyan
$filesChanged = (git diff main..demo --name-only | Measure-Object).Count
Write-Host "Files changed: $filesChanged"
git diff main..demo --shortstat
Write-Host ""
Write-Host "Modified files:"
git diff main..demo --name-only | Select-Object -First 20
if ($filesChanged -gt 20) {
    Write-Host "... and $($filesChanged - 20) more files"
}
Write-Host ""

# Final Summary
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "📊 PRE-MERGE VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $secretsFound) {
    Write-Host "✅ All automated checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual checks still required:"
    Write-Host "  [ ] Test deposit flow with Stripe test card"
    Write-Host "  [ ] Test concurrent reservations"
    Write-Host "  [ ] Test admin operations"
    Write-Host "  [ ] Verify email delivery"
    Write-Host "  [ ] Check health endpoint"
    Write-Host ""
    Write-Host "See MERGE_TO_PRODUCTION.md for complete checklist"
    Write-Host ""
    Write-Host "Ready to merge? Run:" -ForegroundColor Green
    Write-Host "  git checkout main"
    Write-Host "  git merge demo"
    Write-Host "  git push origin main"
} else {
    Write-Host "⚠️  Checks passed with warnings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please review:"
    Write-Host "  - Potential secrets in code"
    Write-Host ""
    Write-Host "See output above for details"
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
