#!/usr/bin/env sh
set -eu

echo "Starting RuralMedAI ML Node Stack..."

LLAMA_PORT="${LLAMA_PORT:-8081}"
ML_PORT="${ML_PORT:-8002}"
LLAMA_MODEL_PATH="${LLAMA_MODEL_PATH:-/models/Qwen3.5-2B-UD-Q4_K_XL.gguf}"
LLAMA_MODEL_URL="${LLAMA_MODEL_URL:-}"
LLAMA_CONTEXT_SIZE="${LLAMA_CONTEXT_SIZE:-1536}"
LLAMA_THREADS="${LLAMA_THREADS:-2}"
LLAMA_BATCH_THREADS="${LLAMA_BATCH_THREADS:-2}"
LLAMA_N_PARALLEL="${LLAMA_N_PARALLEL:-1}"
LLAMA_NGL="${LLAMA_NGL:-0}"
LLAMA_SPEC_TYPE="${LLAMA_SPEC_TYPE:-ngram-mod}"
LLAMA_SPEC_NGRAM_SIZE_N="${LLAMA_SPEC_NGRAM_SIZE_N:-24}"
LLAMA_DRAFT_MIN="${LLAMA_DRAFT_MIN:-48}"
LLAMA_DRAFT_MAX="${LLAMA_DRAFT_MAX:-64}"

LLAMA_SERVER_BIN="$(find /opt/llama -type f -name 'llama-server' | head -n 1)"
if [ -z "${LLAMA_SERVER_BIN}" ]; then
  echo "ERROR: llama-server binary not found under /opt/llama"
  exit 1
fi
LLAMA_SERVER_DIR="$(dirname "${LLAMA_SERVER_BIN}")"
export LD_LIBRARY_PATH="${LLAMA_SERVER_DIR}:${LD_LIBRARY_PATH:-}"

if [ ! -f "${LLAMA_MODEL_PATH}" ]; then
  if [ -n "${LLAMA_MODEL_URL}" ]; then
    echo "Model not found at ${LLAMA_MODEL_PATH}. Downloading from LLAMA_MODEL_URL..."
    mkdir -p "$(dirname "${LLAMA_MODEL_PATH}")"
    MODEL_URL="${LLAMA_MODEL_URL}"
    case "${MODEL_URL}" in
      *huggingface.co*"/blob/"*)
        MODEL_URL="$(printf '%s' "${MODEL_URL}" | sed 's|/blob/|/resolve/|')"
        ;;
    esac
    curl -fL "${MODEL_URL}" -o "${LLAMA_MODEL_PATH}"
  else
    echo "ERROR: Model file not found at ${LLAMA_MODEL_PATH}."
    echo "Set LLAMA_MODEL_URL, or mount your model into /models."
    exit 1
  fi
fi

echo "Starting llama-server on port ${LLAMA_PORT}..."
echo "Llama runtime: ctx=${LLAMA_CONTEXT_SIZE}, parallel=${LLAMA_N_PARALLEL}, threads=${LLAMA_THREADS}, batch_threads=${LLAMA_BATCH_THREADS}"
echo "Speculative decoding: type=${LLAMA_SPEC_TYPE}, ngram_n=${LLAMA_SPEC_NGRAM_SIZE_N}, draft_min=${LLAMA_DRAFT_MIN}, draft_max=${LLAMA_DRAFT_MAX}"
(
cd "${LLAMA_SERVER_DIR}"
./llama-server \
  -m "${LLAMA_MODEL_PATH}" \
  -c "${LLAMA_CONTEXT_SIZE}" \
  --parallel "${LLAMA_N_PARALLEL}" \
  -ngl "${LLAMA_NGL}" \
  -t "${LLAMA_THREADS}" \
  -tb "${LLAMA_BATCH_THREADS}" \
  --spec-type "${LLAMA_SPEC_TYPE}" \
  --spec-ngram-size-n "${LLAMA_SPEC_NGRAM_SIZE_N}" \
  --draft-min "${LLAMA_DRAFT_MIN}" \
  --draft-max "${LLAMA_DRAFT_MAX}" \
  --port "${LLAMA_PORT}" \
  --host 0.0.0.0
) &
LLAMA_PID=$!

sleep 8
if ! kill -0 "${LLAMA_PID}" 2>/dev/null; then
  echo "ERROR: llama-server failed to start (likely wrong architecture binary)."
  exit 1
fi

echo "Starting ML Pipeline Backend (uvicorn) on port ${ML_PORT}..."
uvicorn server:app --host 0.0.0.0 --port "${ML_PORT}" --ws-ping-interval 3600 --ws-ping-timeout 3600 &
UVICORN_PID=$!

term_handler() {
  kill "$UVICORN_PID" 2>/dev/null || true
  kill "$LLAMA_PID" 2>/dev/null || true
}

trap term_handler INT TERM

wait "$UVICORN_PID"
