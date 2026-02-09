export interface Vitals {
    temperature?: string;
    blood_pressure?: string;
    pulse?: string;
    spo2?: string;
}

export interface PatientData {
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
}
