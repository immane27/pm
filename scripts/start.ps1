Set-Location (Join-Path $PSScriptRoot "..")

docker build -t pm-app .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f pm-app *> $null

$envArgs = @()
if (Test-Path .env) { $envArgs = @("--env-file", ".env") }

docker run -d --name pm-app -p 8000:8000 -v pm-data:/data @envArgs pm-app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Running at http://localhost:8000"
