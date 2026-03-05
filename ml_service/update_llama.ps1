$ErrorActionPreference = "Stop"
Write-Host "Fetching latest llama.cpp release info..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest"

$asset = $release.assets | Where-Object { $_.name -match "llama-b\d+-bin-win-vulkan-x64.zip" } | Select-Object -First 1
if (-not $asset) {
    # Fallback to AVX2 if vulkan not found
    $asset = $release.assets | Where-Object { $_.name -match "llama-b\d+-bin-win-avx2-x64.zip" } | Select-Object -First 1
}

$downloadUrl = $asset.browser_download_url
$defaultBaseDir = Join-Path $env:USERPROFILE "Desktop\STT checks"
$baseDir = if ($env:LLAMA_BASE_DIR) { $env:LLAMA_BASE_DIR } else { $defaultBaseDir }
$zipPath = Join-Path $baseDir "llama_latest.zip"
$destPath = Join-Path $baseDir "llama_bin"

New-Item -ItemType Directory -Path $baseDir -Force | Out-Null

Write-Host "Downloading $($asset.name) from $downloadUrl..."
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

Write-Host "Extracting to $destPath..."
Expand-Archive -Path $zipPath -DestinationPath $destPath -Force

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Update complete!"
