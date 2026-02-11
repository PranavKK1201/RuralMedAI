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
    // Eligibility Fields
    ration_card_type?: string;
    income_bracket?: string;
    occupation?: string;
    scheme_eligibility?: {
        pmjay: {
            eligible: boolean;
            reasons: string[];
            confidence: number;
        };
        state_scheme: {
            eligible: boolean;
            reasons: string[];
        };
    };
}
