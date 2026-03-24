#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Smoke test for the Behavioral Intelligence backend
# Usage:
#   ./smoke.sh                          # tests Azure dev backend (default)
#   ./smoke.sh local                    # tests http://localhost:3000
#   BASE_URL=https://my-host ./smoke.sh # tests arbitrary host
# ---------------------------------------------------------------------------
set -euo pipefail

# ── Target URL ──────────────────────────────────────────────────────────────
DEFAULT_DEV_URL="https://bi-backend-dev.azurewebsites.net"
LOCAL_URL="http://localhost:3000"

if [[ "${BASE_URL:-}" != "" ]]; then
  TARGET="$BASE_URL"
elif [[ "${1:-}" == "local" ]]; then
  TARGET="$LOCAL_URL"
else
  TARGET="$DEFAULT_DEV_URL"
fi

echo "Target: $TARGET"
echo "──────────────────────────────────────────"

PASS=0
FAIL=0

# ── Helpers ─────────────────────────────────────────────────────────────────
check() {
  local label="$1"
  local status="$2"
  local body="$3"
  local expect_status="${4:-200}"
  local expect_body="${5:-}"

  local ok=true

  if [[ "$status" != "$expect_status" ]]; then
    ok=false
    echo "FAIL [$label] expected HTTP $expect_status, got $status"
  fi

  if [[ -n "$expect_body" ]] && ! echo "$body" | grep -q "$expect_body"; then
    ok=false
    echo "FAIL [$label] body missing '$expect_body'"
    echo "     body: $body"
  fi

  if $ok; then
    echo "PASS [$label]"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
}

# ── 1. Health ────────────────────────────────────────────────────────────────
echo ""
echo "1. Health check"
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" "$TARGET/health")
BODY=$(cat /tmp/bi_body.txt)
check "GET /health" "$RESP" "$BODY" "200" '"status"'

# ── 2. Session ───────────────────────────────────────────────────────────────
echo ""
echo "2. Session creation"
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" -X POST "$TARGET/session")
BODY=$(cat /tmp/bi_body.txt)
check "POST /session" "$RESP" "$BODY" "200" '"sessionId"'

SESSION_ID=$(echo "$BODY" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
if [[ -z "$SESSION_ID" ]]; then
  echo "FAIL  Could not extract sessionId — stopping"
  exit 1
fi
echo "      sessionId: $SESSION_ID"

# ── 3. Post events ───────────────────────────────────────────────────────────
echo ""
echo "3. Event logging"
NOW_MS=$(date +%s000)

post_event() {
  local game_id="$1"
  local event_type="$2"
  local data="$3"
  curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
    -X POST "$TARGET/event" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"$SESSION_ID\",\"gameId\":\"$game_id\",\"eventType\":\"$event_type\",\"timestamp\":$NOW_MS,\"data\":$data}"
}

RESP=$(post_event "exploration-island" "move" '{"x":1,"y":1}')
BODY=$(cat /tmp/bi_body.txt)
check "POST /event (move)" "$RESP" "$BODY" "201" '"ok"'

RESP=$(post_event "exploration-island" "explore" '{"x":2,"y":2}')
BODY=$(cat /tmp/bi_body.txt)
check "POST /event (explore)" "$RESP" "$BODY" "201" '"ok"'

RESP=$(post_event "hidden-pattern" "attempt" '{"correct":true,"timeMs":1200}')
BODY=$(cat /tmp/bi_body.txt)
check "POST /event (attempt)" "$RESP" "$BODY" "201" '"ok"'

# ── 4. Select games ───────────────────────────────────────────────────────────
echo ""
echo "4. Game selection (LLM)"
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -X POST "$TARGET/select-games" \
  -H "Content-Type: application/json" \
  -d '{
    "userProfile": {
      "age": "28",
      "occupations": ["software_engineer"],
      "occupationTitles": ["Software Engineer"],
      "occupationEmojis": ["💻"],
      "interests": "problem solving, systems design"
    }
  }')
BODY=$(cat /tmp/bi_body.txt)
check "POST /select-games" "$RESP" "$BODY" "200" '"selectedIds"'

# ── 5. Career report (LLM — slowest, ~10-15s) ─────────────────────────────
echo ""
echo "5. Career report (LLM) — may take up to 90s..."
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" --max-time 120 \
  -X POST "$TARGET/career-report" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userProfile\": {
      \"age\": \"28\",
      \"occupation\": \"engineer\",
      \"occupationTitle\": \"Software Engineer\",
      \"occupationEmoji\": \"💻\",
      \"interests\": \"problem solving, systems design\"
    },
    \"gameResults\": [
      {\"configId\": \"exploration-island\", \"gameType\": \"exploration\", \"title\": \"Exploration Island\", \"emoji\": \"🏝️\", \"score\": 72},
      {\"configId\": \"hidden-pattern\",     \"gameType\": \"pattern\",     \"title\": \"Hidden Pattern\",    \"emoji\": \"🔍\", \"score\": 85}
    ]
  }")
BODY=$(cat /tmp/bi_body.txt)
check "POST /career-report" "$RESP" "$BODY" "200" '"aiReport"'

# ── 6. Cache hit (repeat career-report, should be instant) ────────────────
echo ""
echo "6. Career report cache hit"
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" --max-time 10 \
  -X POST "$TARGET/career-report" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userProfile\": {
      \"age\": \"28\",
      \"occupation\": \"engineer\",
      \"occupationTitle\": \"Software Engineer\",
      \"occupationEmoji\": \"💻\",
      \"interests\": \"problem solving, systems design\"
    },
    \"gameResults\": [
      {\"configId\": \"exploration-island\", \"gameType\": \"exploration\", \"title\": \"Exploration Island\", \"emoji\": \"🏝️\", \"score\": 72}
    ]
  }")
BODY=$(cat /tmp/bi_body.txt)
check "POST /career-report (cached)" "$RESP" "$BODY" "200" '"aiReport"'

# ── 7. Validation — bad event payload ─────────────────────────────────────
echo ""
echo "7. Input validation"
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -X POST "$TARGET/event" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"not-a-uuid","gameId":"x","eventType":"y","timestamp":0,"data":{}}')
BODY=$(cat /tmp/bi_body.txt)
check "POST /event bad uuid → 400" "$RESP" "$BODY" "400" '"error"'

# ── 8. Auth flow ──────────────────────────────────────────────────────────────
echo ""
echo "8. Auth flow (register / login / me / logout / bad-password)"

# Use a timestamp-based email so each run registers a fresh account
AUTH_EMAIL="smoke_$(date +%s)@test.local"
AUTH_PASS="Smoke1234!"
AUTH_NAME="Smoke User"

# 8a. Register new account
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -X POST "$TARGET/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASS\",\"displayName\":\"$AUTH_NAME\"}")
BODY=$(cat /tmp/bi_body.txt)
check "POST /auth/register" "$RESP" "$BODY" "201" '"accessToken"'

ACCESS_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 8b. Login with same credentials
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -X POST "$TARGET/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASS\"}")
BODY=$(cat /tmp/bi_body.txt)
check "POST /auth/login" "$RESP" "$BODY" "200" '"accessToken"'

REFRESH_TOKEN=$(echo "$BODY" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

# 8c. GET /auth/me with Bearer token
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$TARGET/auth/me")
BODY=$(cat /tmp/bi_body.txt)
check "GET /auth/me" "$RESP" "$BODY" "200" '"email"'

# 8d. Logout (revoke refresh token)
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -X POST "$TARGET/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
BODY=$(cat /tmp/bi_body.txt)
check "POST /auth/logout" "$RESP" "$BODY" "200" '"ok"'

# 8e. Login with wrong password → 401
RESP=$(curl -s -o /tmp/bi_body.txt -w "%{http_code}" \
  -X POST "$TARGET/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"wrongpassword\"}")
BODY=$(cat /tmp/bi_body.txt)
check "POST /auth/login bad password -> 401" "$RESP" "$BODY" "401" '"error"'

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
