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

$port = 8765
$server = Start-Process -FilePath $python -ArgumentList "-m http.server $port --bind 127.0.0.1 --directory `"$root`"" -PassThru -WindowStyle Hidden
try {
  $ready = $false
  for ($i = 0; $i -lt 50 -and -not $ready; $i++) {
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$port/landing/index.html" -UseBasicParsing -TimeoutSec 1 | Out-Null
      $ready = $true
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  if (-not $ready) { throw "visual server failed to start" }
  $base = "http://127.0.0.1:$port"

  function Shot([string]$url, [string]$name, [string]$size) {
    $profile = Join-Path $env:TEMP ("edgeprof_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory $profile | Out-Null
    $file = Join-Path $out ($name + ".png")
    & $edge --headless=new --disable-gpu --hide-scrollbars --disable-features=ServiceWorker --user-data-dir=$profile `
      --window-size=$size --virtual-time-budget=4000 --screenshot=$file $url 2>$null | Out-Null
    Start-Sleep -Milliseconds 700
    Write-Output ("shot " + $name)
  }

  $landing = "$base/landing/index.html?static=1"
  $landingEn = "$base/landing/en/index.html?static=1"
  $imu = "$base/imu-lab/static/index.html"
  $control = "$base/control-play/index.html?kp=3&ki=1&kd=0.1"
  $controlIndex = "$base/control-play/index.html"
  $about = "$base/about/index.html"
  $aboutMatlab = "$base/about/matlab.html"
  $aboutEn = "$base/about/en.html"
  $sim = "$base/simulink/index.html"
  $model = "$base/model-lab/static/index.html"

  Shot $landing "landing" "1400,1000"
  Shot $landingEn "landing-en" "1400,1000"
  Shot $imu "imu" "1400,1400"
  Shot ($imu + "#manual") "imu-manual" "1400,1400"
  Shot $control "control" "1400,1200"
  Shot ($controlIndex + "#labs&K=1") "control-k1" "1400,1400"
  Shot ($controlIndex + "#labs&K=50") "control-k50" "1400,1400"
  Shot ($controlIndex + "#manual") "control-manual" "1400,1400"
  Shot $about "about" "1200,1600"
  Shot $aboutMatlab "about-matlab" "1400,2200"
  Shot $aboutEn "about-en" "1200,1600"
  Shot $sim "simulink" "1400,1400"
  Shot $model "model" "1400,1400"
  Shot $imu "imu-narrow" "520,900"
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}

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
