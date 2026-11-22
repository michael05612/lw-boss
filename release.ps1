# 發布新版本：改版本號 → 存檔進 git → 推上 GitHub（GitHub Pages 約 1 分鐘後自動上線）
# 用法：powershell -ExecutionPolicy Bypass -File release.ps1 -Message "這次改了什麼"
param([string]$Message = "更新")

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$ver = Get-Date -Format 'yyyy-MM-dd.HHmm'

# 1. 版本號（大家開著的網頁會偵測到並提示更新）
$vf = Join-Path $PSScriptRoot 'js\version.js'
$txt = [IO.File]::ReadAllText($vf, $utf8) -replace "LW_APP_VERSION = '[^']*'", "LW_APP_VERSION = '$ver'"
[IO.File]::WriteAllText($vf, $txt, $utf8)

# 2. index.html 裡的 ?v= （讓瀏覽器一定抓新檔案，不用舊快取）
$hf = Join-Path $PSScriptRoot 'index.html'
$html = [IO.File]::ReadAllText($hf, $utf8) -replace '\?v=[0-9A-Za-z.\-]+', "?v=$ver"
[IO.File]::WriteAllText($hf, $html, $utf8)
Write-Host "版本 $ver"

# 3. 推上 GitHub
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git -and (Test-Path 'C:\Program Files\Git\cmd\git.exe')) { $git = 'C:\Program Files\Git\cmd\git.exe' }
if (-not $git) { Write-Host '找不到 git，請先安裝 Git（見 上線步驟.md）'; exit 1 }
& $git add -A
& $git commit -m "$ver $Message"
& $git push
Write-Host '已推上 GitHub，約 1 分鐘後網站更新。'
