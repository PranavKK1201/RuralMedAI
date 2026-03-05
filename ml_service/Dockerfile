FROM python:3.12-slim

ARG TARGETARCH
ARG LLAMA_CPP_URL=https://github.com/ggml-org/llama.cpp/releases/download/b8200/llama-b8200-bin-ubuntu-x64.tar.gz

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl jq ca-certificates unzip libgomp1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY ml_service/requirements.txt /app/requirements.txt
RUN set -eux; \
    python -m pip install --upgrade pip setuptools wheel; \
    for i in 1 2 3; do \
      pip install --no-cache-dir --retries 10 --timeout 180 --prefer-binary -r /app/requirements.txt && break; \
      if [ "$i" -eq 3 ]; then \
        echo "pip install failed after 3 attempts"; \
        exit 1; \
      fi; \
      echo "pip install failed (attempt $i/3), retrying..."; \
      sleep 5; \
    done

# Equivalent to update_llama.ps1: fetch llama.cpp Linux binaries
RUN set -eux; \
    asset_url="${LLAMA_CPP_URL}"; \
    if [ -z "$asset_url" ]; then \
      echo "LLAMA_CPP_URL is empty"; \
      exit 1; \
    fi; \
    echo "Using llama.cpp asset: ${asset_url}"; \
    mkdir -p /opt/llama && cd /tmp; \
    case "$asset_url" in \
      *.zip) \
        curl -fL "$asset_url" -o /tmp/llama.zip; \
        unzip -q /tmp/llama.zip -d /opt/llama; \
        ;; \
      *.tar.gz) \
        curl -fL "$asset_url" -o /tmp/llama.tar.gz; \
        tar -xzf /tmp/llama.tar.gz -C /opt/llama; \
        ;; \
      *) \
        echo "Unsupported asset format: $asset_url"; \
        exit 1; \
        ;; \
    esac; \
    rm -f /tmp/llama.zip /tmp/llama.tar.gz; \
    chmod +x "$(find /opt/llama -type f -name 'llama-server' | head -n 1)"

COPY ml_service /app/ml_service
COPY .env.example /app/.env.example

WORKDIR /app/ml_service
RUN chmod +x /app/ml_service/start_ml.sh

EXPOSE 8002 8081

CMD ["/app/ml_service/start_ml.sh"]
