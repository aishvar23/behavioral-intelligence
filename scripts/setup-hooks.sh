#!/usr/bin/env bash
# One-time setup: installs the pre-push git hook.
# Run once after cloning: bash scripts/setup-hooks.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"

cp "$ROOT/scripts/pre-push.sh" "$HOOK"
chmod +x "$HOOK"

echo "✓ Pre-push hook installed at $HOOK"
echo "  Tests will run automatically on every 'git push'."
