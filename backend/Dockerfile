FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_SYSTEM_PYTHON=1
ENV UV_NO_CACHE=1
ENV HF_HUB_OFFLINE=0
# Will be set to 1 after model bake-in; 0 during build to allow initial download

# Inject uv from the official image (no extra layer cost)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev wget unzip \
    && rm -rf /var/lib/apt/lists/*

# Pre-download ICD-10-PCS data from CMS to avoid runtime downloads
RUN mkdir -p /data_bootstrap && \
    wget -q --user-agent="Mozilla/5.0" -O /tmp/pcs.zip "https://www.cms.gov/files/zip/2025-icd-10-pcs-order-file-long-and-abbreviated-titles.zip" && \
    unzip -q /tmp/pcs.zip -d /tmp/pcs_extracted && \
    # The order file is the largest .txt file in the archive
    FILE_NAME=$(ls -S /tmp/pcs_extracted/*.txt | head -n 1) && \
    mv "$FILE_NAME" /data_bootstrap/icd10pcs_order_2025.txt && \
    rm -rf /tmp/pcs.zip /tmp/pcs_extracted

COPY requirements.txt /app/requirements.txt
# Force CPU-only PyTorch to avoid gigabytes of CUDA/NVIDIA overhead
RUN uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN uv pip install -r /app/requirements.txt

# Pre-install the scispacy clinical model (~400MB) via uv
RUN uv pip install "https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.4/en_core_sci_md-0.5.4.tar.gz"

# Pre-download the sentence-transformers embedding model into the image (avoids
# runtime HuggingFace requests). Cached to /root/.cache/huggingface and baked
# into this image layer — no network needed after build.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2'); print('Embedding model cached.')"

# Lock HF Hub to offline mode — all weights are now in the image
ENV HF_HUB_OFFLINE=1

COPY backend /app/backend
WORKDIR /app/backend

# Move the bootstrapped clinical data into the app directory
RUN mkdir -p /app/backend/data && mv /data_bootstrap/icd10pcs_order_2025.txt /app/backend/data/

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
