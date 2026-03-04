# RuralMedAI 🏥

**RuralMedAI** is a real-time AI medical scribe and clinical billing automation system designed for doctors in rural areas. It listens to doctor-patient conversations, automatically structures the clinical encounter, auto-codes diagnoses and procedures using offline ICD-10 NLP, and assembles an insurer-agnostic billing claim — reducing manual documentation and insurance friction.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎙️ **Real-time Scribe** | Gemini Live audio → structured patient data (demographics, vitals, history, diagnosis, procedures) |
| 🔖 **Hybrid ICD-10 Coding** | 4-tier NLP (Exact → Word TF-IDF → Char N-gram → Semantic) auto-suggests diagnosis & procedure codes |
| � **Intelligent Search** | Keyword-dominant hybrid search with partial word (bigram) support — search "Feve" for "Fever" |
| 🧾 **Billing Automation** | Insurer-agnostic `BillingClaim` assembled after every EHR commit (background task, non-blocking) |
| 📋 **Encounter Audit** | Clinician can review, edit, and confirm auto-coded billing claims before submission |
|  **Clinical Trends** | Aggregate top diagnoses, procedures, and symptoms across all patient records |
| 🏛️ **Scheme Eligibility** | Auto-checks PM-JAY, CGHS, ECHS, and state scheme eligibility from socio-economic data |
| 🔐 **Encrypted Storage** | Patient fields encrypted at rest with AES-256-GCM before PostgreSQL persistence |

---

## 🚀 How to Run

### Option A: Docker (Recommended)
This starts **PostgreSQL + Backend + Frontend** in one command with shared memory and data persistence.

1. Copy `.env.example` to `.env` and fill in `AES_256_KEY` and `GEMINI_API_KEY`.
2. Run from the project root:
   ```bash
   docker compose up --build
   ```

**Services:**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8003` (Indexing progress visible in `docker logs`)

---

### Option B: Local Dev

#### Terminal 1 — Backend
```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_sci_md
python -m uvicorn app.main:app --reload --port 8003
```

#### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Terminal 3 — Local ML Node (Optional)
If you want to use the low-latency local Qwen + Groq STT pipeline instead of Gemini, start the ML Node service.

1. Ensure the `Qwen3.5-2B-UD-Q4_K_XL.gguf` model and `llama-server.exe` are available in the desktop folder as outlined in `start_ml.ps1`.
2. Navigate to the `ml_service` folder and run the startup script:
    ```powershell
    cd ml_service
    .\start_ml.ps1
    ```

---

## 🧠 Under the Hood (Billing Backend)

### 1. Hybrid Search Architecture
To ensure clinical accuracy and high-speed retrieval, the search engine utilizes a weighted hybrid approach:
- **Priority 1 (Exact Match)**: Direct code lookup (e.g., `R50.9`) returns immediately.
- **Priority 2 (Keyword Index)**: 40% Weight for exact word matches (TF-IDF).
- **Priority 3 (Char N-gram)**: 30% Weight for partial word/typo hits (3-4 char n-grams).
- **Priority 4 (Semantic)**: 30% Weight for conceptual similarity (ChromaDB + `all-MiniLM-L6-v2`).

### 2. Efficiency & Performance
- **Shared Singleton Embedder**: The encoding model is loaded once and shared across services, saving ~300MB RAM and reducing startup time.
- **Persistent Indexing**: All TF-IDF and N-gram indexes are cached to disk (`joblib`) and load in <1s on subsequent restarts.
- **Docker-Visible Progress**: Custom manual batch logging ensures you can see indexing progress live in the Docker console.

---

## 🔒 Security & Privacy
- **AES-256-GCM Encryption**: All PII (Personally Identifiable Information) is encrypted at the application layer before reaching the DB.
- **100% Offline Coding**: Diagnosis and procedure coding is done entirely on your local CPU. No clinical data leaves your infrastructure for coding.
- **Gemini Live**: Only the audio stream for transcription is processed via Google Gemini API (encrypted in transit).

---

## 📂 Project Structure

### `backend/app/`
- **`api/ehr.py`**: All REST endpoints (EHR commit, billing, search).
- **`services/shared_embedder.py`**: Singleton manager for the embedding model.
- **`services/icd_coding_service.py`**: Hybrid search and suggestion for ICD-10-CM.
- **`services/procedure_coding_service.py`**: Hybrid search and suggestion for ICD-10-PCS.
- **`services/billing_service.py`**: Assembles the billing claim payload.
- **`database.py`**: PostgreSQL client with integrated encryption/decryption.

### `frontend/app/`
- **`page.tsx`**: The main scribe console (Mic → Gemini → Live Form).
- **`diagnostics/page.tsx`**: 3-Tab Billing Center (Audits, Search, Claims).
- **`patients/page.tsx`**: Historic record browser with clinical analytics.

### `ml_service/` (The Edge Nodes ⚡)
This folder contains the extremely low-latency local execution alternative to Google Gemini.
*   **`server.py`**: The bridge that concurrently processes continuous microphone data through Groq's high-speed Whisper VAD wrapper, bypassing conversational latency.
*   **`start_ml.ps1`**: The hyper-optimized startup script that manages Llama.cpp's hardware thread bindings alongside the FastAPI bridge.
