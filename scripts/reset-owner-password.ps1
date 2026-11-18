param([switch]$Staging, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$database = if ($Staging) { 'traderelaycity-staging' } else { 'traderelaycity' }
$target = @(if ($Staging) { '--env'; 'staging'; '--remote' } else { '--local' })
$targetLabel = if ($Staging) { 'staging' } else { 'local' }

function Convert-SecretToText([securestring]$Value) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Push-Location $projectRoot
try {
  $ownerQuery = 'SELECT u.id, u.username, (SELECT COUNT(*) FROM "account" a WHERE a."userId"=u.id AND a."providerId"=''credential'') AS credentialCount FROM app_settings s JOIN "user" u ON u.id=s.value WHERE s.key=''owner_user_id'''
  $ownerOutput = & npx wrangler d1 execute $database @target --command $ownerQuery --json 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Could not read the $targetLabel owner record." }
  $ownerResponse = $ownerOutput | Out-String | ConvertFrom-Json
  $owners = @($ownerResponse[0].results)
  if ($owners.Count -ne 1 -or $owners[0].credentialCount -ne 1) { throw "Expected one configured $targetLabel owner credential." }
  $owner = $owners[0]
  if ($owner.id -cnotmatch '^[a-fA-F0-9-]{36}$' -or $owner.username -cnotmatch '^[a-zA-Z0-9_.]{3,30}$') { throw 'Owner identity has an unexpected format.' }
  Write-Host "$targetLabel owner username: $($owner.username)"
  if ($CheckOnly) { return }

  $typedUsername = Read-Host "Type $($owner.username) to confirm the $targetLabel password reset"
  if ($typedUsername -cne $owner.username) { throw 'Owner username confirmation did not match.' }
  $passwordInput = $null
  $confirmationInput = $null
  try {
    $passwordInput = Read-Host 'Choose new owner password (12 to 128 characters)' -AsSecureString
    $confirmationInput = Read-Host 'Confirm new owner password' -AsSecureString
    $password = Convert-SecretToText $passwordInput
    $confirmation = Convert-SecretToText $confirmationInput
    if ($password -cne $confirmation) { throw 'Passwords do not match.' }
    if ($password.Length -lt 12 -or $password.Length -gt 128) { throw 'Password must be 12 to 128 characters.' }
    $hash = $password | & node (Join-Path $PSScriptRoot 'hash-owner-password.mjs')
    if ($LASTEXITCODE -ne 0 -or $hash -cnotmatch '^[a-f0-9]+:[a-f0-9]+$') { throw 'Password hashing failed.' }
  } finally {
    $password = $null
    $confirmation = $null
    if ($passwordInput) { $passwordInput.Dispose() }
    if ($confirmationInput) { $confirmationInput.Dispose() }
  }

  $ownerId = $owner.id
  $sql = @"
DELETE FROM "session" WHERE "userId"='$ownerId';
UPDATE "account" SET "password"='$hash', "updatedAt"=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE "userId"='$ownerId' AND "providerId"='credential';
SELECT (SELECT COUNT(*) FROM "account" WHERE "userId"='$ownerId' AND "providerId"='credential' AND "password"='$hash') AS updatedCredentials, (SELECT COUNT(*) FROM "session" WHERE "userId"='$ownerId') AS activeSessions;
"@
  $sqlPath = Join-Path ([System.IO.Path]::GetTempPath()) ("trc-owner-reset-" + [guid]::NewGuid().ToString() + '.sql')
  try {
    [System.IO.File]::WriteAllText($sqlPath, $sql, [System.Text.UTF8Encoding]::new($false))
    $resultOutput = & npx wrangler d1 execute $database @target --file $sqlPath --yes --json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Could not reset the $targetLabel owner password." }
    $result = $resultOutput | Out-String | ConvertFrom-Json
    $verification = $result[-1].results[0]
    if ($verification.updatedCredentials -ne 1 -or $verification.activeSessions -ne 0) { throw 'Password reset verification failed.' }
    Write-Host "$targetLabel owner password reset. Existing website sessions were revoked."
  } finally {
    $hash = $null
    $sql = $null
    [System.IO.File]::Delete($sqlPath)
  }
} finally {
  Pop-Location
}
