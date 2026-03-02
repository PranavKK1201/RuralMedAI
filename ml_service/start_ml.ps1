Write-Host "Starting RuralMedAI ML Node Stack..." -ForegroundColor Cyan

# ── 1. Start llama-server (Qwen3.5 2B) ───────────────────────────────────────
# We assume the user has the llama_bin accessible or downloaded in this folder.
# For this repo, we will point to the same Qwen model downloaded earlier.
Write-Host "Starting Qwen3.5 2B (llama-server) on port 8081..." -ForegroundColor Yellow
$base_dir = Resolve-Path "..\..\..\Desktop\STT checks" | Select-Object -ExpandProperty Path
$llama_cmd = Join-Path $base_dir "llama_bin\llama-server.exe"
$model_path = Join-Path $base_dir "Qwen3.5-2B-UD-Q4_K_XL.gguf"

if (Test-Path $llama_cmd) {
    # Keep the window open if it fails by running it via cmd /k, or just use precise arguments
    $args_string = "-m `"$model_path`" -c 16384 -ngl 99 --port 8081 --host 127.0.0.1"
    Start-Process -FilePath $llama_cmd -ArgumentList $args_string -WorkingDirectory $base_dir
} else {
    Write-Host "ERROR: llama-server.exe not found. Please ensure it is installed or update this path." -ForegroundColor Red
}

Write-Host "Waiting for model to load..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# ── 2. Start ML FastAPI Node ──────────────────────────────────────────────────
Write-Host "Starting ML Pipeline Backend (uvicorn) on port 8002..." -ForegroundColor Green
# Start the ML processor bridge using python -m to ensure it finds the path
Start-Process -FilePath "python" -ArgumentList "-m uvicorn server:app --host 0.0.0.0 --port 8002"

Write-Host ""
Write-Host "ML Node is running!" -ForegroundColor Cyan
Write-Host "Qwen API:  localhost:8081" -ForegroundColor White
Write-Host "ML Stream: localhost:8002/ws/process-audio" -ForegroundColor White
