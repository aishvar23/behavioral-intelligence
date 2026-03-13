#!/usr/bin/env bash
# Pre-push hook: runs the full test suite before allowing a push.
# Install via:  bash scripts/setup-hooks.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Running tests before push…       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "▶ Backend tests (Jest / ts-jest)"
cd "$ROOT/backend"
if ! npm test --silent; then
  echo ""
  echo "✗ Backend tests failed. Push aborted."
  exit 1
fi
echo "✓ Backend tests passed."
echo ""

# ── Mobile ───────────────────────────────────────────────────────────────────
echo "▶ Mobile tests (Jest / react-native preset)"
cd "$ROOT/mobile"
if ! npm test --watchAll=false --silent; then
  echo ""
  echo "✗ Mobile tests failed. Push aborted."
  exit 1
fi
echo "✓ Mobile tests passed."
echo ""

echo "✓ All tests passed — pushing."
echo ""
