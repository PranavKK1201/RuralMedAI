export interface Vitals {
    temperature?: string;
    blood_pressure?: string;
    pulse?: number;
    spo2?: number;
}

export interface PatientData {
    name?: string;
    age?: number;
    gender?: string;
    chief_complaint?: string;
    symptoms?: string[];
    vitals?: Vitals;
    medical_history?: string[];
    allergies?: string[];
    tentative_doctor_diagnosis?: string;
    initial_llm_diagnosis?: string;
    medications?: string[];
}
