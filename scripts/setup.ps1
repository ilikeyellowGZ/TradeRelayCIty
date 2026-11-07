param([switch]$Start)
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required. Install the current LTS release, then rerun this setup.' }
$nodeVersion = [version](node -p "process.versions.node")
if ($nodeVersion -lt [version]'22.12.0') { throw "Node.js 22.12 or newer is required by the Better Auth CLI; found $nodeVersion." }
$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) { Write-Warning 'Python launcher not found. The web simulation works without Python; install Python 3.14 x64 to build the optional Windows connector.' }

npm ci
if (-not (Test-Path .dev.vars)) {
  $localSecret = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))"
  @('SIMULATION_MODE=true','APP_BASE_URL=http://127.0.0.1:5173',"BETTER_AUTH_SECRET=$localSecret") | Set-Content -LiteralPath .dev.vars -Encoding ascii
}
npm run db:migrate:local
Write-Host 'Local simulation is ready. No broker or AI keys are needed.'
if ($Start) { npm run dev }
