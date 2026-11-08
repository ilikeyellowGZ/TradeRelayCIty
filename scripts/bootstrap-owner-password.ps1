param([switch]$Remote, [string]$Username = 'iluvpistachioos')
$ErrorActionPreference = 'Stop'

if ($Username -cnotmatch '^[a-zA-Z0-9_.]{3,30}$') { throw 'Username must be 3 to 30 letters, digits, underscores, or dots.' }
$Username = $Username.ToLowerInvariant()
$target = if ($Remote) { '--remote' } else { '--local' }
$ownerCheck = & npx wrangler d1 execute traderelaycity $target --command "SELECT value FROM app_settings WHERE key='owner_user_id'" --json 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Could not check the owner record. Apply migrations first.' }
$ownerRows = $ownerCheck | Out-String | ConvertFrom-Json
if ($ownerRows[0].results.Count -gt 0) { throw 'An owner is already configured. This script will not replace the owner or password.' }

function Convert-SecretToText([securestring]$Value) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$passwordInput = Read-Host 'Choose owner password (12 to 128 characters)' -AsSecureString
$confirmationInput = Read-Host 'Confirm owner password' -AsSecureString
$password = Convert-SecretToText $passwordInput
$confirmation = Convert-SecretToText $confirmationInput
try {
  if ($password -cne $confirmation) { throw 'Passwords do not match.' }
  if ($password.Length -lt 12 -or $password.Length -gt 128) { throw 'Password must be 12 to 128 characters.' }
  $hash = $password | & node (Join-Path $PSScriptRoot 'hash-owner-password.mjs')
  if ($LASTEXITCODE -ne 0 -or -not $hash) { throw 'Password hashing failed.' }
} finally {
  $password = $null
  $confirmation = $null
  $passwordInput.Dispose()
  $confirmationInput.Dispose()
}

$userId = [guid]::NewGuid().ToString()
$accountId = [guid]::NewGuid().ToString()
$internalEmail = "owner-$userId@traderelaycity.invalid"
$sql = @"
INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "username")
SELECT '$userId', '$Username', '$internalEmail', 0, CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000, '$Username'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key='owner_user_id');
INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT '$accountId', '$userId', 'credential', '$userId', '$hash', CAST(strftime('%s','now') AS INTEGER)*1000, CAST(strftime('%s','now') AS INTEGER)*1000
WHERE EXISTS (SELECT 1 FROM "user" WHERE "id"='$userId');
INSERT INTO app_settings (key, value)
SELECT 'owner_user_id', '$userId'
WHERE EXISTS (SELECT 1 FROM "account" WHERE "id"='$accountId');
SELECT value AS owner_user_id FROM app_settings WHERE key='owner_user_id';
"@
$sqlPath = Join-Path ([System.IO.Path]::GetTempPath()) ("trc-owner-password-" + [guid]::NewGuid().ToString() + '.sql')
try {
  [System.IO.File]::WriteAllText($sqlPath, $sql, [System.Text.UTF8Encoding]::new($false))
  $result = & npx wrangler d1 execute traderelaycity $target --file $sqlPath 2>&1
  $resultText = $result | Out-String
  if ($LASTEXITCODE -ne 0 -or $resultText -notmatch [regex]::Escape($userId)) { throw 'Owner setup failed. Check migrations or whether an owner already exists.' }
  Write-Host "Owner username ready: $Username"
  Write-Host 'The password was hashed before storage and was not written to .dev.vars.'
} finally {
  [System.IO.File]::Delete($sqlPath)
}
