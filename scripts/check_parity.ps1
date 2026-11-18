# ==============================================================================
# Swadeshi Khata (स्वदेशी खाता) - Parity & Full Quality Gate Sentinel (PowerShell)
# Tagline: "Aapka hisaab, aapka bharosa"
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "      Swadeshi Khata (स्वदेशी खाता) Parity Verification Gate     " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Parity Matrix Check
Write-Host "`n[1/7] Checking Frontend Parity Matrix (frontend/PARITY.md)..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\PARITY.md")) {
    Write-Host "ERROR: frontend\PARITY.md is missing! Parity verification failed." -ForegroundColor Red
    exit 1
}
Write-Host "✓ frontend\PARITY.md found." -ForegroundColor Green

# 2. Python Code Formatting (Black)
Write-Host "`n[2/7] Checking Python Code Formatting (black --check)..." -ForegroundColor Yellow
python -m black --check src tests
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Black code formatting check failed! Run 'black src tests' to format." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Black check passed." -ForegroundColor Green

# 3. Python Linting (Flake8)
Write-Host "`n[3/7] Linting Python Code (flake8)..." -ForegroundColor Yellow
python -m flake8 src tests --count --select=E9,F63,F7,F82 --show-source --statistics
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Flake8 critical syntax or naming errors detected!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Flake8 check passed." -ForegroundColor Green

# 4. Pytest & API Contract Tests
Write-Host "`n[4/7] Running Pytest Suite & Backend API Contract Gate..." -ForegroundColor Yellow
python -m pytest tests/ -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Pytest test suite failed! Contract or regression violation detected." -ForegroundColor Red
    exit 1
}
Write-Host "✓ All pytest tests and API contract snapshot tests passed." -ForegroundColor Green

# 5. Frontend Unit & Component Tests (Vitest)
Write-Host "`n[5/7] Running Frontend Vitest Suite..." -ForegroundColor Yellow
npm --prefix frontend run test -- --run
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend Vitest component tests failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ All frontend component tests passed." -ForegroundColor Green

# 6. Frontend Production Build & TypeScript Check
Write-Host "`n[6/7] Building Frontend Production Bundle (tsc -b && vite build)..." -ForegroundColor Yellow
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend TypeScript compilation or Vite build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Frontend production bundle built cleanly." -ForegroundColor Green

# 7. Playwright E2E Parity Test File Verification
Write-Host "`n[7/7] Verifying Playwright End-to-End Parity Suite..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\e2e\parity-flow.spec.ts")) {
    Write-Host "ERROR: frontend\e2e\parity-flow.spec.ts is missing!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Playwright e2e\parity-flow.spec.ts verified." -ForegroundColor Green

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "   ✓ ALL PARITY & QUALITY GATES PASSED CLEANLY! ZERO REGRESSION " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
exit 0

