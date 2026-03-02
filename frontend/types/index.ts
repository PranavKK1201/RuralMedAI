export interface Vitals {
    temperature?: string;
    blood_pressure?: string;
    pulse?: string;
    spo2?: string;
}

export interface SchemeEligibilitySnapshot {
    pmjay: {
        eligible: boolean;
        reasons: string[];
        confidence: number;
    };
    state_scheme: {
        eligible: boolean;
        reasons: string[];
    };
}

export interface PatientData {
    id?: number;
    name?: string;
    age?: string;
    gender?: string;
    chief_complaint?: string;
    symptoms?: string[];
    vitals?: Vitals;
    medical_history?: string[];
    family_history?: string[];
    allergies?: string[];
    tentative_doctor_diagnosis?: string;
    initial_llm_diagnosis?: string;
    medications?: string[];
    // Eligibility Fields
    ration_card_type?: string;
    income?: string;
    occupation?: string;
    caste_category?: string;
    housing_type?: string;
    location?: string;
    scheme_eligibility?: SchemeEligibilitySnapshot;
}

export interface TranscriptItem {
    id: string;
    type: 'text' | 'tool';
    content?: string;
    timestamp: string;
    toolInfo?: {
        field: string;
        value: unknown;
    };
}

export interface ScribeSessionSnapshot {
    patientData: PatientData;
    transcript: TranscriptItem[];
    activePatientId?: number | null;
    entryMode?: 'create' | 'update';
    updatedAt: string;
}
