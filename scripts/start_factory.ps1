#Factory Dashboard - All-in-One Startup Script
#Starts ComfyUI, Agent Engine (FastAPI), and Next.js Dashboard in sequence.
#Waits for each service to be ready before proceeding.
#Logs everything to console with color-coded status.

param(
    [switch]$SkipComfyUI,
    [switch]$SkipEngine,
    [switch]$SkipDashboard,
    [string]$ComfyUIMode = "gpu"
)

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot ".env.local"

# -- Helpers --
function Write-Header($msg) {
    Write-Host ""
    Write-Host ("=" * 51) -ForegroundColor DarkCyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host ("=" * 51) -ForegroundColor DarkCyan
}
function Write-OK($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Waiting($msg) { Write-Host "  [WAIT] $msg" -ForegroundColor DarkYellow }

# -- Load .env.local --
function Load-EnvFile($path) {
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                $key = $parts[0].Trim()
                $val = $parts[1].Trim()
                [Environment]::SetEnvironmentVariable($key, $val, "Process")
            }
        }
        Write-OK "Loaded .env.local"
    } else {
        Write-Warn ".env.local not found - using defaults"
    }
}

# -- Port Check --
function Test-Port($port, $timeoutSec = 2) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $result = $client.BeginConnect("127.0.0.1", $port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(($timeoutSec * 1000), $false)
        $client.Close()
        return $success
    } catch { return $false }
}

function Wait-ForPort($port, $serviceName, $maxWaitSec = 120) {
    $elapsed = 0
    $waitMsg = "Waiting for $serviceName on port $port (max $maxWaitSec sec)..."
    while ($elapsed -lt $maxWaitSec) {
        if (Test-Port $port) {
            Write-OK "$serviceName is ready on port $port"
            return $true
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
        if ($elapsed % 10 -eq 0) {
            Write-Waiting "$waitMsg [$elapsed sec]"
        }
    }
    Write-Err "$serviceName did not start within $maxWaitSec sec on port $port"
    return $false
}

# -- HTTP Health Check --
function Wait-ForHttp($url, $serviceName, $maxWaitSec = 60) {
    $elapsed = 0
    while ($elapsed -lt $maxWaitSec) {
        try {
            $resp = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -lt 500) {
                Write-OK "$serviceName responded (HTTP $($resp.StatusCode)) at $url"
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 2
        $elapsed += 2
        if ($elapsed % 10 -eq 0) {
            Write-Waiting "Waiting for $serviceName HTTP at $url... [$elapsed sec]"
        }
    }
    Write-Err "$serviceName did not respond within $maxWaitSec sec at $url"
    return $false
}

# =====================================================================
Write-Header "AI INFLUENCER FACTORY - STARTUP"
Write-Info "Project: $ProjectRoot"
Write-Info "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
# =====================================================================

Load-EnvFile $EnvFile

$ComfyUIPort   = 8188
$EnginePort    = 8787
$DashboardPort = 3000

$Results = @{
    ComfyUI   = $false
    Engine    = $false
    Dashboard = $false
}

# -- 1. ComfyUI --
Write-Header "Step 1/3: ComfyUI (port $ComfyUIPort)"

if ($SkipComfyUI) {
    Write-Info "Skipped (SkipComfyUI flag)"
    $Results.ComfyUI = Test-Port $ComfyUIPort
} elseif (Test-Port $ComfyUIPort) {
    Write-OK "ComfyUI already running on port $ComfyUIPort"
    $Results.ComfyUI = $true
} else {
    $comfyBat = $env:COMFYUI_BAT_GPU
    if ($ComfyUIMode -eq "cpu" -or -not $comfyBat) {
        $comfyBat = $env:COMFYUI_BAT_CPU
    }
    if (-not $comfyBat) {
        $comfyBat = "C:\ComfyUI_windows_portable\run_nvidia_gpu.bat"
    }
    if (-not (Test-Path $comfyBat)) {
        Write-Err "ComfyUI batch not found: $comfyBat"
        Write-Info "Set COMFYUI_BAT_GPU or COMFYUI_BAT_CPU in .env.local"
    } else {
        Write-Info "Starting ComfyUI from: $comfyBat"
        $comfyDir = Split-Path $comfyBat -Parent
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$comfyBat`"" -WorkingDirectory $comfyDir -WindowStyle Minimized
        $Results.ComfyUI = Wait-ForHttp "http://127.0.0.1:$ComfyUIPort/system_stats" "ComfyUI" 90
    }
}

# -- 2. Agent Engine (FastAPI / Uvicorn) --
Write-Header "Step 2/3: Agent Engine (port $EnginePort)"

if ($SkipEngine) {
    Write-Info "Skipped (SkipEngine flag)"
    $Results.Engine = Test-Port $EnginePort
} elseif (Test-Port $EnginePort) {
    Write-OK "Agent Engine already running on port $EnginePort"
    $Results.Engine = $true
} else {
    $engineDir = Join-Path $ProjectRoot "agent_engine"
    if (-not (Test-Path (Join-Path $engineDir "main.py"))) {
        Write-Err "Agent engine not found at $engineDir"
    } else {
        Write-Info "Starting Agent Engine (uvicorn)..."
        Start-Process -FilePath "python" `
            -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$EnginePort", "--reload" `
            -WorkingDirectory $engineDir -WindowStyle Minimized
        $Results.Engine = Wait-ForHttp "http://127.0.0.1:$EnginePort/health" "Agent Engine" 60
    }
}

# -- 3. Next.js Dashboard --
Write-Header "Step 3/3: Dashboard (port $DashboardPort)"

if ($SkipDashboard) {
    Write-Info "Skipped (SkipDashboard flag)"
    $Results.Dashboard = Test-Port $DashboardPort
} elseif (Test-Port $DashboardPort) {
    Write-OK "Dashboard already running on port $DashboardPort"
    $Results.Dashboard = $true
} else {
    if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
        Write-Warn "node_modules not found - running npm install..."
        Push-Location $ProjectRoot
        npm install 2>&1 | ForEach-Object { Write-Info $_ }
        Pop-Location
    }
    Write-Info "Starting Next.js dashboard..."
    Start-Process -FilePath "npm" -ArgumentList "start" `
        -WorkingDirectory $ProjectRoot -WindowStyle Minimized
    $Results.Dashboard = Wait-ForHttp "http://127.0.0.1:$DashboardPort" "Dashboard" 60
}

# -- Summary --
Write-Header "STARTUP SUMMARY"

$statusList = @(
    @{ Name = "ComfyUI";      Port = $ComfyUIPort;   OK = $Results.ComfyUI }
    @{ Name = "Agent Engine"; Port = $EnginePort;    OK = $Results.Engine }
    @{ Name = "Dashboard";    Port = $DashboardPort; OK = $Results.Dashboard }
)

foreach ($s in $statusList) {
    $icon = if ($s.OK) { "[OK]" } else { "[FAIL]" }
    $state = if ($s.OK) { "RUNNING" } else { "DOWN" }
    $line = "  $icon $($s.Name.PadRight(16)) port $($s.Port)  $state"
    if ($s.OK) {
        Write-Host $line -ForegroundColor Green
    } else {
        Write-Host $line -ForegroundColor Red
    }
}

$allUp = $Results.ComfyUI -and $Results.Engine -and $Results.Dashboard
if ($allUp) {
    Write-Host ""
    Write-Host "  All services running! Dashboard: http://localhost:$DashboardPort" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  Some services failed. Check logs above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Press Ctrl+C to stop monitoring (services will keep running)" -ForegroundColor DarkGray

# -- Keep-alive monitor --
try {
    while ($true) {
        Start-Sleep -Seconds 30
        $c = if (Test-Port $ComfyUIPort) { "[OK]" } else { "[--]" }
        $e = if (Test-Port $EnginePort) { "[OK]" } else { "[--]" }
        $d = if (Test-Port $DashboardPort) { "[OK]" } else { "[--]" }
        $ts = (Get-Date).ToString("HH:mm:ss")
        Write-Host "`r  [$ts] ComfyUI:$c  Engine:$e  Dashboard:$d  " -NoNewline -ForegroundColor DarkGray
    }
} catch {
    Write-Host ""
    Write-Host "  Shutting down monitor." -ForegroundColor DarkGray
}
