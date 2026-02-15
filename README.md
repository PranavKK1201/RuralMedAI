# RuralMedAI 🏥

**RuralMedAI** is a real-time AI medical scribe designed for doctors in rural areas. It listens to doctor-patient conversations and automatically fills out a medical form, so the doctor can focus on the patient instead of typing.

---

## 🚀 How to Run

You need to run two separate terminals: one for the **Backend** (Brain) and one for the **Frontend** (UI).

### Terminal 1: Backend
The backend connects to Google Gemini and processes the audio.

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
2.  Navigate to the backend folder:
    ```bash
    cd backend
    ```
3.  Start the server:
    ```bash
    python -m uvicorn app.main:app --reload --port 8003
    ```

### Terminal 2: Frontend
The frontend captures your microphone and displays the form.

1.  Navigate to the frontend folder:
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure (Simple Explanation)

### `backend/` (The Brain 🧠)
This folder handles the logic and AI connection.

*   **`app/main.py`**: The entry point. It answers the phone (WebSocket) when the Frontend calls.
*   **`app/services/gemini_service.py`**: The AI connector. It sends audio to Google Gemini and gets text back.
*   **`app/services/prompt_eng.py`**: The Instructions. It tells the AI: *"You are a medical scribe. Extract Name, Age, Symptoms..."*
*   **`app/core/schemas.py`**: The Rulebook. It defines what valid patient data looks like (e.g., Age must be a number).
*   **`app/api/routes.py`**: The Assistant. It handles extra tasks like generating a final summary note.

### `frontend/` (The Face 💻)
This folder handles what you see and interact with.

*   **`src/app/page.tsx`**: The Main Dashboard. It connects everything together (Mic -> AI -> Form).
*   **`src/components/LiveForm.tsx`**: The Magic Form. It watches for data updates and highlights fields in blue when they change.
*   **`src/hooks/useAudioStream.ts`**: The Ears. It turns on your microphone and processes the audio.
*   **`public/worklet.js`**: The Translator. It converts your browser's audio format (48kHz) to the specific format Gemini needs (16kHz).
