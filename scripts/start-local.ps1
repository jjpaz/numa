$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectDir '.venv\Scripts\python.exe'
$vitePath = Join-Path $projectDir 'node_modules\vite\bin\vite.js'
$logDir = Join-Path $projectDir '.local'
if (-not (Test-Path -LiteralPath $pythonPath) -or -not (Test-Path -LiteralPath $vitePath)) {
    throw 'Install Python and npm dependencies using README.md first.'
}
foreach ($port in @(8000, 5173)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use. Stop that server or use the manual commands in README.md."
    }
}
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$previousMode = $env:NUMA_DEMO_MODE
$previousDb = $env:DATABASE_URL
# Preview must not connect to any configured database. Env values beat dotenv defaults.
$env:NUMA_DEMO_MODE = 'true'
$env:DATABASE_URL = ' '
try {
    $api = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','backend.preview:create_preview','--factory','--host','127.0.0.1','--port','8000') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') -RedirectStandardError (Join-Path $logDir 'backend.err.log')
    $web = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"' + $vitePath + '"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'frontend.out.log') -RedirectStandardError (Join-Path $logDir 'frontend.err.log')
    Write-Output "Numa local preview: http://127.0.0.1:5173"
    Write-Output "Backend PID: $($api.Id); frontend PID: $($web.Id). Logs: $logDir"
} finally {
    $env:NUMA_DEMO_MODE = $previousMode
    $env:DATABASE_URL = $previousDb
}
