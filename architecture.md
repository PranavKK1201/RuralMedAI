# Parchee.ai System Architecture

The following diagram illustrates the high-level architecture of Parchee.ai, centered around three core pillars: **Transcription**, **Documentation**, and **Insurance**. It highlights the flow from patient interaction to revenue output, powered by a robust backend and advanced AI models.

```mermaid
graph TB
    %% Styling
    classDef core fill:#f9f9f9,stroke:#333,stroke-width:2px;
    classDef input fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef process fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef output fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px;
    classDef ext fill:#eceff1,stroke:#546e7a,stroke-dasharray: 5 5;

    %% User Layer
    subgraph UserLayer["User Interaction"]
        direction LR
        P([Patient]) <--> |Voice/Consultation| D([Doctor])
        D <--> |"Parchee.ai Interface (Next.js)"| Frontend
    end

    %% Application Layer
    subgraph AppLayer["Application Logic (FastAPI Backend)"]
        direction TB
        API["API Gateway / WebSocket Handler"]

        subgraph Core1["1. Transcription (Input Engine)"]
            direction TB
            Bharat["'Bharat' Engine<br/>(Dialect/Zero-shot ASR)"]
            Trans["Medical Translation<br/>(Colloquial to ICD-10)"]
            Extract["Entity Extraction<br/>(Vitals, Symptoms, Dx)"]
        end

        subgraph Core2["2. Documentation (Clinical Process)"]
            direction TB
            TaskID["Task Transaction ID Manager"]
            Summaries["Role-Based Summary Generator<br/>(Doctor/Nurse/Pharma)"]
            Safety["Safety Conflict Engine<br/>(DDI & Allergies)"]
            Alerts["Critical Alert Flagging"]
        end

        subgraph Core3["3. Insurance (Revenue Output)"]
            direction TB
            Schemes["Scheme-Specific Generators<br/>(PM-JAY, CGHS, ECHS)"]
            Gap["Pre-Claim Gap Analysis"]
            Audit["Forensic Audit Trails"]
            AutoCode["ICD-10 Auto-Coding"]
        end
    end

    %% External Intelligence Layer
    subgraph AI["Intelligence Layer"]
        Gemini["Google Gemini<br/>(Multimodal Live API)"]
    end

    %% Data Layer
    subgraph Data["Data Layer"]
        DB[(Secure Database<br/>Immutable Logs)]
    end

    %% Connections
    Frontend <--> |WebSocket/REST| API
    API --> Core1
    
    %% Core 1 Flow
    Core1 <--> |Audio/Video Stream| Gemini
    Bharat --> Trans --> Extract
    Extract --> Core2

    %% Core 2 Flow
    Core2 --> |"Structured Data"| DB
    Core2 --> |"Real-time Alerts"| Frontend
    TaskID --> Summaries --> Safety

    %% Core 3 Flow
    Core3 --> |"Fetch Data"| DB
    Core3 --> |"Generate Claims"| Frontend
    Gap --> Schemes
    
    %% Apply Styling
    class Core1 input
    class Core2 process
    class Core3 output
    class Gemini,DB ext
    class Frontend,API core
```

## detailed Components Breakdown

### 1. Transcription (The Input Engine)
*Primary Goal: Zero-shot support for Indian rural dialects & Code-Switching.*
- **'Bharat' Engine**: Handles *Bhojpuri*, *Maithili*, *Haryanvi* without fine-tuning.
- **Medical Translation**: Maps colloquial terms ("Ghabrahat") to standardized *ICD-10* terminology.
- **Multi-Modal Ingestion**: Captures voice and OCR inputs simultaneously.

### 2. Documentation (The Clinical Process)
*Primary Goal: Ensure accountability and distinct outputs for every stakeholder.*
- **Transaction ID Manager**: Assigns a unique ID to every task for auditability.
- **Role-Based Summaries**: Generates *Clinical Note* (Doctor), *Administer List* (Nurse), and *Dispense List* (Pharmacy).
- **Safety Conflict Engine**: Checks for *Drug-Drug Interactions* and *Allergy Contraindications* in real-time.

### 3. Insurance (The Revenue Output)
*Primary Goal: Prevent revenue leakage and ensure claim acceptance.*
- **Scheme Generators**: Automates forms for *Ayushman Bharat*, *CGHS*, *ECHS*.
- **Pre-Claim Gap Analysis**: Acts as a "Spell Check" for insurance evidence.
- **Forensic Audit Trails**: Timestamped, immutable logs for fraud auditing.
