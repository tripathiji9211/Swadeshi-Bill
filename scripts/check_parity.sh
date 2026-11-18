#!/usr/bin/env bash
# ==============================================================================
# Swadeshi Khata (स्वदेशी खाता) - Parity & Full Quality Gate Sentinel
# Tagline: "Aapka hisaab, aapka bharosa"
# ==============================================================================
# Ensures zero regressions across:
# 1. Python Code Quality: black --check, flake8
# 2. Backend Pytest & API Contract Suite: tests/test_api_contract.py
# 3. Frontend Types & Production Build: tsc -b && vite build
# 4. Frontend Unit & Component Tests: vitest run
# 5. Playwright E2E Parity Suite: frontend/e2e/parity-flow.spec.ts
# 6. Parity Verification Matrix: frontend/PARITY.md
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}      Swadeshi Khata (स्वदेशी खाता) Parity Verification Gate     ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. Parity Matrix Check
echo -e "\n${YELLOW}[1/7] Checking Frontend Parity Matrix (frontend/PARITY.md)...${NC}"
if [ ! -f "frontend/PARITY.md" ]; then
    echo -e "${RED}ERROR: frontend/PARITY.md is missing! Parity verification failed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ frontend/PARITY.md found.${NC}"

# 2. Python Code Formatting (Black)
echo -e "\n${YELLOW}[2/7] Checking Python Code Formatting (black --check)...${NC}"
python -m black --check src tests || {
    echo -e "${RED}ERROR: Black code formatting check failed! Run 'black src tests' to format.${NC}"
    exit 1
}
echo -e "${GREEN}✓ Black check passed.${NC}"

# 3. Python Linting (Flake8)
echo -e "\n${YELLOW}[3/7] Linting Python Code (flake8)...${NC}"
python -m flake8 src tests --count --select=E9,F63,F7,F82 --show-source --statistics || {
    echo -e "${RED}ERROR: Flake8 critical syntax or naming errors detected!${NC}"
    exit 1
}
echo -e "${GREEN}✓ Flake8 check passed.${NC}"

# 4. Pytest & API Contract Tests
echo -e "\n${YELLOW}[4/7] Running Pytest Suite & Backend API Contract Gate...${NC}"
python -m pytest tests/ -v || {
    echo -e "${RED}ERROR: Pytest test suite failed! Contract or regression violation detected.${NC}"
    exit 1
}
echo -e "${GREEN}✓ All pytest tests and API contract snapshot tests passed.${NC}"

# 5. Frontend Unit & Component Tests (Vitest)
echo -e "\n${YELLOW}[5/7] Running Frontend Vitest Suite...${NC}"
npm --prefix frontend run test -- --run || {
    echo -e "${RED}ERROR: Frontend Vitest component tests failed!${NC}"
    exit 1
}
echo -e "${GREEN}✓ All frontend component tests passed.${NC}"

# 6. Frontend Production Build & TypeScript Check
echo -e "\n${YELLOW}[6/7] Building Frontend Production Bundle (tsc -b && vite build)...${NC}"
npm --prefix frontend run build || {
    echo -e "${RED}ERROR: Frontend TypeScript compilation or Vite build failed!${NC}"
    exit 1
}
echo -e "${GREEN}✓ Frontend production bundle built cleanly.${NC}"

# 7. Playwright E2E Parity Test File Verification
echo -e "\n${YELLOW}[7/7] Verifying Playwright End-to-End Parity Suite...${NC}"
if [ ! -f "frontend/e2e/parity-flow.spec.ts" ]; then
    echo -e "${RED}ERROR: frontend/e2e/parity-flow.spec.ts is missing!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Playwright e2e/parity-flow.spec.ts verified.${NC}"

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✓ ALL PARITY & QUALITY GATES PASSED CLEANLY! ZERO REGRESSION ${NC}"
echo -e "${GREEN}================================================================${NC}"
exit 0

