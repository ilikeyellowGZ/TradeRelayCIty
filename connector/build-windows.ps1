$ErrorActionPreference = 'Stop'
$Python = Get-Command py -ErrorAction SilentlyContinue
if (-not $Python) { throw 'Python launcher not found. Install Python 3.12 or 3.13 for connector packaging.' }
py -3 --version
if ($LASTEXITCODE -ne 0) { throw 'No usable Python runtime was found.' }
py -3 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
& .\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --windowed --name TradeRelayCity-Connector --paths . connector_launcher.py
Write-Host 'Build completed at dist\TradeRelayCity-Connector\TradeRelayCity-Connector.exe'
