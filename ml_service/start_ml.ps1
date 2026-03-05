Write-Host "Starting RuralMedAI ML Node Stack..." -ForegroundColor Cyan

# ── Runtime settings (aligned with start_ml.sh) ───────────────────────────────
$LLAMA_PORT = if ($env:LLAMA_PORT) { $env:LLAMA_PORT } else { "8081" }
$ML_PORT = if ($env:ML_PORT) { $env:ML_PORT } else { "8002" }
$LLAMA_CONTEXT_SIZE = if ($env:LLAMA_CONTEXT_SIZE) { $env:LLAMA_CONTEXT_SIZE } else { "1536" }
$LLAMA_THREADS = if ($env:LLAMA_THREADS) { $env:LLAMA_THREADS } else { "2" }
$LLAMA_BATCH_THREADS = if ($env:LLAMA_BATCH_THREADS) { $env:LLAMA_BATCH_THREADS } else { "2" }
$LLAMA_N_PARALLEL = if ($env:LLAMA_N_PARALLEL) { $env:LLAMA_N_PARALLEL } else { "1" }
$LLAMA_NGL = if ($env:LLAMA_NGL) { $env:LLAMA_NGL } else { "auto" }
$LLAMA_SPEC_TYPE = if ($env:LLAMA_SPEC_TYPE) { $env:LLAMA_SPEC_TYPE } else { "ngram-mod" }
$LLAMA_SPEC_NGRAM_SIZE_N = if ($env:LLAMA_SPEC_NGRAM_SIZE_N) { $env:LLAMA_SPEC_NGRAM_SIZE_N } else { "24" }
$LLAMA_DRAFT_MIN = if ($env:LLAMA_DRAFT_MIN) { $env:LLAMA_DRAFT_MIN } else { "48" }
$LLAMA_DRAFT_MAX = if ($env:LLAMA_DRAFT_MAX) { $env:LLAMA_DRAFT_MAX } else { "64" }

$defaultBaseDir = Join-Path $env:USERPROFILE "Desktop\STT checks"
$baseDir = if ($env:LLAMA_BASE_DIR) { $env:LLAMA_BASE_DIR } else { $defaultBaseDir }
$llamaCmd = if ($env:LLAMA_SERVER_BIN) { $env:LLAMA_SERVER_BIN } else { Join-Path $baseDir "llama_bin\llama-server.exe" }
$modelPath = if ($env:LLAMA_MODEL_PATH) { $env:LLAMA_MODEL_PATH } else { Join-Path $baseDir "Qwen3.5-2B-UD-Q4_K_XL.gguf" }

if ($LLAMA_NGL -eq "auto") {
    # Use GPU offload by default when available (NVIDIA/Vulkan path).
    $hasGpu = $false
    try {
        $null = Get-Command nvidia-smi -ErrorAction Stop
        $hasGpu = $true
    }
    catch {
        $vulkanRuntime = Join-Path $env:WINDIR "System32\vulkan-1.dll"
        if (Test-Path $vulkanRuntime) {
            $hasGpu = $true
        }
    }
    $LLAMA_NGL = if ($hasGpu) { "99" } else { "0" }
}

# ── 1. Start llama-server (Qwen3.5 2B) ───────────────────────────────────────
Write-Host "Starting Qwen3.5 2B (llama-server) on port $LLAMA_PORT..." -ForegroundColor Yellow
if (-not (Test-Path $llamaCmd)) {
    Write-Host "ERROR: llama-server.exe not found at: $llamaCmd" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $modelPath)) {
    Write-Host "ERROR: model not found at: $modelPath" -ForegroundColor Red
    exit 1
}

Write-Host "Llama runtime: ctx=$LLAMA_CONTEXT_SIZE, parallel=$LLAMA_N_PARALLEL, ngl=$LLAMA_NGL, threads=$LLAMA_THREADS, batch_threads=$LLAMA_BATCH_THREADS" -ForegroundColor Gray
Write-Host "Speculative decoding: type=$LLAMA_SPEC_TYPE, ngram_n=$LLAMA_SPEC_NGRAM_SIZE_N, draft_min=$LLAMA_DRAFT_MIN, draft_max=$LLAMA_DRAFT_MAX" -ForegroundColor Gray

$llamaArgs = @(
    "-m", $modelPath,
    "-c", $LLAMA_CONTEXT_SIZE,
    "--parallel", $LLAMA_N_PARALLEL,
    "-ngl", $LLAMA_NGL,
    "-t", $LLAMA_THREADS,
    "-tb", $LLAMA_BATCH_THREADS,
    "--spec-type", $LLAMA_SPEC_TYPE,
    "--spec-ngram-size-n", $LLAMA_SPEC_NGRAM_SIZE_N,
    "--draft-min", $LLAMA_DRAFT_MIN,
    "--draft-max", $LLAMA_DRAFT_MAX,
    "--port", $LLAMA_PORT,
    "--host", "127.0.0.1"
)

Start-Process -FilePath $llamaCmd -ArgumentList $llamaArgs -WorkingDirectory (Split-Path $llamaCmd)

Write-Host "Waiting for model to load..." -ForegroundColor Gray
Start-Sleep -Seconds 8

# ── 2. Start ML FastAPI Node ──────────────────────────────────────────────────
Write-Host "Starting ML Pipeline Backend (uvicorn) on port $ML_PORT..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k python -m uvicorn server:app --host 0.0.0.0 --port $ML_PORT --ws-ping-interval 3600 --ws-ping-timeout 3600"

Write-Host ""
Write-Host "ML Node is running!" -ForegroundColor Cyan
Write-Host "Qwen API:  localhost:$LLAMA_PORT" -ForegroundColor White
Write-Host "ML Stream: localhost:$ML_PORT/ws/process-audio" -ForegroundColor White
