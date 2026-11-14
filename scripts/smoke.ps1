# Headless DOM smoke test (Edge --dump-dom, works without CDP/pipes)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$edge = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Edge not found" }

function Get-Dom([string]$url) {
  $tmp = [System.IO.Path]::GetTempFileName()
  & $edge --headless=new --disable-gpu --virtual-time-budget=4000 --dump-dom $url 2>$null |
    Out-File -FilePath $tmp -Encoding utf8
  $html = Get-Content $tmp -Raw
  Remove-Item $tmp -Force
  return $html
}

$imu = ([uri](Join-Path $root "imu-lab\static\index.html")).AbsoluteUri
$dom = Get-Dom $imu
if ($dom -notmatch "chart-time") { throw "imu: time chart missing" }
if ($dom -notmatch "ARW=") { throw "imu: fit info missing" }
if ($dom -notmatch "R²") { throw "imu: R² missing" }
if ($dom -notmatch "演示数据") { throw "imu: demo badge missing" }

$control = ([uri](Join-Path $root "control-play\index.html")).AbsoluteUri + "?kp=3&ki=1&kd=0.1"
$dom2 = Get-Dom $control
if ($dom2 -notmatch "Kp=3\.00") { throw "control: PID params not applied from URL" }
if ($dom2 -notmatch "相位") { throw "control: Bode phase axis missing" }
if ($dom2 -notmatch "闭环") { throw "control: closed-loop series missing" }

Write-Output "SMOKE OK (imu + control)"
