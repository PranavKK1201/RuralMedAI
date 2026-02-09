export interface Vitals {
    temperature?: string;
    blood_pressure?: string;
    pulse?: number;
    spo2?: number;
    respiratory_rate?: number;
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
    diagnosis?: string;
    medications?: string[];
}
