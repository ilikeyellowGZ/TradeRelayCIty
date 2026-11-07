param([switch]$Local)
$ErrorActionPreference = 'Stop'

$email = (Read-Host 'Owner email (used as an account identifier, not verified by email)').Trim().ToLowerInvariant()
$name = (Read-Host 'Owner display name').Trim()
if ($email.Length -gt 254 -or $email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Enter a valid email address.' }
if (-not $name -or $name.Length -gt 80) { throw 'Enter a display name up to 80 characters.' }

$tokenBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($tokenBytes)
$token = [Convert]::ToHexString($tokenBytes).ToLowerInvariant()
$tokenHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([System.Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
$inviteId = [guid]::NewGuid().ToString()
$userId = [guid]::NewGuid().ToString()
$emailSql = $email.Replace("'", "''")
$nameSql = $name.Replace("'", "''")
$sql = @"
INSERT INTO invitations(id,user_id,email,display_name,role,token_hash,expires_at,created_by)
SELECT '$inviteId','$userId','$emailSql','$nameSql','owner','$tokenHash',datetime('now','+48 hours'),NULL
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key='owner_user_id')
  AND NOT EXISTS (SELECT 1 FROM invitations WHERE role='owner' AND consumed_at IS NULL AND expires_at > datetime('now'))
RETURNING id;
"@
$sqlPath = Join-Path ([System.IO.Path]::GetTempPath()) ("trc-owner-invite-" + [guid]::NewGuid().ToString() + '.sql')
try {
  [System.IO.File]::WriteAllText($sqlPath, $sql, [System.Text.UTF8Encoding]::new($false))
  if ($Local) { $result = & npx wrangler d1 execute traderelaycity --local --file $sqlPath 2>&1 }
  else { $result = & npx wrangler d1 execute traderelaycity --remote --file $sqlPath 2>&1 }
  $exitCode = $LASTEXITCODE
  $resultText = $result | Out-String
  Write-Host $resultText
  if ($exitCode -ne 0 -or $resultText -notmatch [regex]::Escape($inviteId)) { throw 'Could not create the one-time owner invitation. An owner may already be initialized.' }
} finally {
  Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
}
$baseUrl = ''
if ($Local -and (Test-Path .dev.vars)) { $baseUrl = (Get-Content .dev.vars | Where-Object { $_ -match '^APP_BASE_URL=' } | Select-Object -First 1) -replace '^APP_BASE_URL=', '' }
if (-not $baseUrl) { $baseUrl = Read-Host 'Application base URL (must match Better Auth origin exactly)' }
Write-Host "Owner invitation (expires in 48 hours): $baseUrl/enroll?token=$token"
Write-Host 'Treat this link like a credential. Open it once in a trusted browser and finish passkey enrollment.'
