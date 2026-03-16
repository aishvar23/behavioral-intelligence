# ---------------------------------------------------------------------------
# Smoke test for the Behavioral Intelligence backend
# Usage:
#   .\smoke.ps1                                        # tests Azure dev backend (default)
#   .\smoke.ps1 -Target local                          # tests http://localhost:3000
#   .\smoke.ps1 -Target https://my-custom-host.com     # tests arbitrary host
# ---------------------------------------------------------------------------

param(
  [string]$Target = ""
)

# -- Target URL ---------------------------------------------------------------
$DevUrl   = "https://bi-backend-dev.azurewebsites.net"
$LocalUrl = "http://localhost:3000"

if ($Target -eq "local") {
  $BaseUrl = $LocalUrl
} elseif ($Target -ne "") {
  $BaseUrl = $Target
} else {
  $BaseUrl = $DevUrl
}

Write-Host "Target: $BaseUrl"
Write-Host ("-" * 50)

$Pass = 0
$Fail = 0

# -- Helpers ------------------------------------------------------------------
function Invoke-Endpoint {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Body = $null
  )
  try {
    $params = @{
      Method          = $Method
      Uri             = $Url
      Headers         = @{ "Content-Type" = "application/json" }
      TimeoutSec      = 30
      UseBasicParsing = $true
    }
    if ($null -ne $Body) {
      $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    $response = Invoke-WebRequest @params -ErrorAction Stop
    return @{ Status = [int]$response.StatusCode; Body = $response.Content }
  } catch {
    $statusCode = [int]$_.Exception.Response.StatusCode.value__
    $errorBody  = $_.ErrorDetails.Message
    return @{ Status = $statusCode; Body = $errorBody }
  }
}

function Check {
  param(
    [string]$Label,
    [int]$Status,
    [string]$Body,
    [int]$ExpectStatus = 200,
    [string]$ExpectBody = ""
  )

  $ok = $true

  if ($Status -ne $ExpectStatus) {
    $ok = $false
    Write-Host "FAIL [$Label] expected HTTP $ExpectStatus, got $Status"
  }

  if ($ExpectBody -ne "" -and $Body -notmatch [regex]::Escape($ExpectBody)) {
    $ok = $false
    Write-Host "FAIL [$Label] body missing '$ExpectBody'"
    Write-Host "     body: $Body"
  }

  if ($ok) {
    Write-Host "PASS [$Label]"
    $script:Pass++
  } else {
    $script:Fail++
  }
}

# -- 1. Health ----------------------------------------------------------------
Write-Host ""
Write-Host "1. Health check"
$r = Invoke-Endpoint -Method GET -Url "$BaseUrl/health"
Check -Label "GET /health" -Status $r.Status -Body $r.Body -ExpectStatus 200 -ExpectBody '"status"'

# -- 2. Session ---------------------------------------------------------------
Write-Host ""
Write-Host "2. Session creation"
$r = Invoke-Endpoint -Method POST -Url "$BaseUrl/session"
Check -Label "POST /session" -Status $r.Status -Body $r.Body -ExpectStatus 200 -ExpectBody '"sessionId"'

$sessionData = $r.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
$SessionId   = $sessionData.sessionId

if (-not $SessionId) {
  Write-Host "FAIL  Could not extract sessionId - stopping"
  exit 1
}
Write-Host "      sessionId: $SessionId"

# -- 3. Post events -----------------------------------------------------------
Write-Host ""
Write-Host "3. Event logging"
$NowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Post-Event {
  param([string]$GameId, [string]$EventType, [hashtable]$Data)
  return Invoke-Endpoint -Method POST -Url "$BaseUrl/event" -Body @{
    sessionId = $SessionId
    gameId    = $GameId
    eventType = $EventType
    timestamp = $NowMs
    data      = $Data
  }
}

$r = Post-Event -GameId "exploration-island" -EventType "move"    -Data @{ x = 1; y = 1 }
Check -Label "POST /event (move)"    -Status $r.Status -Body $r.Body -ExpectStatus 201 -ExpectBody '"ok"'

$r = Post-Event -GameId "exploration-island" -EventType "explore"  -Data @{ x = 2; y = 2 }
Check -Label "POST /event (explore)" -Status $r.Status -Body $r.Body -ExpectStatus 201 -ExpectBody '"ok"'

$r = Post-Event -GameId "hidden-pattern"     -EventType "attempt"  -Data @{ correct = $true; timeMs = 1200 }
Check -Label "POST /event (attempt)" -Status $r.Status -Body $r.Body -ExpectStatus 201 -ExpectBody '"ok"'

# -- 4. Select games ----------------------------------------------------------
Write-Host ""
Write-Host "4. Game selection (LLM)"
$r = Invoke-Endpoint -Method POST -Url "$BaseUrl/select-games" -Body @{
  userProfile = @{
    age             = "28"
    occupation      = "engineer"
    occupationTitle = "Software Engineer"
    occupationEmoji = "engineer"
    interests       = "problem solving, systems design"
  }
}
Check -Label "POST /select-games" -Status $r.Status -Body $r.Body -ExpectStatus 200 -ExpectBody '"games"'

# -- 5. Career report (LLM - slowest, ~10-15s) --------------------------------
Write-Host ""
Write-Host "5. Career report (LLM) - may take up to 20s..."
$r = Invoke-Endpoint -Method POST -Url "$BaseUrl/career-report" -Body @{
  sessionId   = $SessionId
  userProfile = @{
    age             = "28"
    occupation      = "engineer"
    occupationTitle = "Software Engineer"
    occupationEmoji = "engineer"
    interests       = "problem solving, systems design"
  }
  gameResults = @(
    @{ configId = "exploration-island"; gameType = "exploration"; title = "Exploration Island"; emoji = "island"; score = 72 },
    @{ configId = "hidden-pattern";     gameType = "pattern";     title = "Hidden Pattern";    emoji = "search"; score = 85 }
  )
}
Check -Label "POST /career-report" -Status $r.Status -Body $r.Body -ExpectStatus 200 -ExpectBody '"aiReport"'

# -- 6. Cache hit -------------------------------------------------------------
Write-Host ""
Write-Host "6. Career report cache hit"
$r = Invoke-Endpoint -Method POST -Url "$BaseUrl/career-report" -Body @{
  sessionId   = $SessionId
  userProfile = @{
    age             = "28"
    occupation      = "engineer"
    occupationTitle = "Software Engineer"
    occupationEmoji = "engineer"
    interests       = "problem solving, systems design"
  }
  gameResults = @(
    @{ configId = "exploration-island"; gameType = "exploration"; title = "Exploration Island"; emoji = "island"; score = 72 }
  )
}
Check -Label "POST /career-report (cached)" -Status $r.Status -Body $r.Body -ExpectStatus 200 -ExpectBody '"aiReport"'

# -- 7. Input validation ------------------------------------------------------
Write-Host ""
Write-Host "7. Input validation"
$r = Invoke-Endpoint -Method POST -Url "$BaseUrl/event" -Body @{
  sessionId = "not-a-uuid"
  gameId    = "x"
  eventType = "y"
  timestamp = 0
  data      = @{}
}
Check -Label "POST /event bad uuid -> 400" -Status $r.Status -Body $r.Body -ExpectStatus 400 -ExpectBody '"error"'

# -- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 50)
Write-Host "Results: $Pass passed, $Fail failed"
Write-Host ("=" * 50)

if ($Fail -gt 0) {
  exit 1
}
