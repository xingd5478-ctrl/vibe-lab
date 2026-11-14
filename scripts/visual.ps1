# Visual check / regression: screenshot key pages (desktop + narrow) and compare with baselines.
param([switch]$Update, [double]$Threshold = 0.003, [string]$BaselineDir = "tests\baselines")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "artifacts\visual"
$baseline = Join-Path $root $BaselineDir
New-Item -ItemType Directory -Force $out | Out-Null
New-Item -ItemType Directory -Force $baseline | Out-Null
$edge = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Edge not found" }
$python = "D:\Anaconda\python.exe"
if (-not (Test-Path $python)) { $python = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $python) { throw "python not found" }

function Shot([string]$url, [string]$name, [string]$size) {
  $profile = Join-Path $env:TEMP ("edgeprof_" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory $profile | Out-Null
  $file = Join-Path $out ($name + ".png")
  & $edge --headless=new --disable-gpu --hide-scrollbars --user-data-dir=$profile `
    --window-size=$size --virtual-time-budget=4000 --screenshot=$file $url 2>$null | Out-Null
  Start-Sleep -Milliseconds 700
  Write-Output ("shot " + $name)
}

$landing = ([uri](Join-Path $root "landing\index.html")).AbsoluteUri
$imu = ([uri](Join-Path $root "imu-lab\static\index.html")).AbsoluteUri
$control = ([uri](Join-Path $root "control-play\index.html")).AbsoluteUri + "?kp=3&ki=1&kd=0.1"
$about = ([uri](Join-Path $root "about\index.html")).AbsoluteUri

Shot $landing "landing" "1400,1000"
Shot $imu "imu" "1400,1400"
Shot $control "control" "1400,1200"
Shot $about "about" "1200,1600"
Shot $imu "imu-narrow" "520,900"

& $python (Join-Path $PSScriptRoot "check_png.py") $out
if ($LASTEXITCODE -ne 0) { throw "blank/small screenshot" }

if ($Update) {
  Copy-Item (Join-Path $out "*.png") $baseline -Force
  Write-Output "BASELINES UPDATED"
  exit 0
}

& $python (Join-Path $PSScriptRoot "compare_png.py") $baseline $out $Threshold
if ($LASTEXITCODE -ne 0) { throw "visual regression" }
Write-Output "VISUAL OK"
