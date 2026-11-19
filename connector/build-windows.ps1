param([Parameter(Mandatory = $true)][string]$WebsiteUrl)
$ErrorActionPreference = 'Stop'
$Site = $null
if (-not [Uri]::TryCreate($WebsiteUrl, [UriKind]::Absolute, [ref]$Site) -or $Site.Scheme -ne 'https' -or -not $Site.Host -or $Site.UserInfo -or $Site.AbsolutePath -ne '/' -or $Site.Query -or $Site.Fragment) {
    throw 'WebsiteUrl must be a bare HTTPS origin, for example https://traderelaycity.example'
}
Push-Location $PSScriptRoot
try {
    $ReleaseConfig = Join-Path $PSScriptRoot 'assets\release-site.json'
    [System.IO.File]::WriteAllText($ReleaseConfig, ((@{ website_url = $Site.GetLeftPart([UriPartial]::Authority) } | ConvertTo-Json -Compress)), [System.Text.UTF8Encoding]::new($false))
    $Python = Get-Command py -ErrorAction SilentlyContinue
    if (-not $Python) { throw 'Python launcher not found. Install Python 3.12 or 3.13 for connector packaging.' }
    py -3 --version
    if ($LASTEXITCODE -ne 0) { throw 'No usable Python runtime was found.' }
    if (-not (Test-Path .\.venv\Scripts\python.exe)) {
        py -3 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the connector Python environment.' }
    }
    & .\.venv\Scripts\python.exe -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw 'Could not update pip.' }
    & .\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Could not install connector dependencies.' }
    node .\generate_icon.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate the connector icon.' }
    $IconPath = Join-Path $PSScriptRoot 'assets\TradeRelayCity.ico'
    & .\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --onefile --windowed --name TradeRelayCity-Connector --icon $IconPath --add-data "$IconPath;assets" --add-data "$ReleaseConfig;assets" --paths . --distpath release-dist --workpath release-build\work --specpath release-build connector_launcher.py
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the connector.' }
    & .\.venv\Scripts\python.exe .\package_release.py
    if ($LASTEXITCODE -ne 0) { throw 'Could not publish the website download.' }
    Write-Host 'Build completed at release-dist\TradeRelayCity-Connector.exe'
} finally {
    Pop-Location
}
