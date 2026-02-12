# backend/app/core/schemas.py
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

class Vitals(BaseModel):
    temperature: Optional[str] = Field(None, description="Body Temperature (e.g., 98.6 F)")
    blood_pressure: Optional[str] = Field(None, description="Blood Pressure (e.g., 120/80 mmHg)")
    pulse: Optional[str] = Field(None, description="Heart Rate in BPM")
    spo2: Optional[str] = Field(None, description="Oxygen Saturation in %")

class PatientData(BaseModel):
    id: Optional[int] = Field(None, description="Existing patient record ID for updates")

    # Demographics
    name: Optional[str] = Field(None, description="Patient's full name")
    age: Optional[str] = Field(None, description="Patient's age in years")
    gender: Optional[str] = Field(None, description="Patient's gender (Male/Female/Other)")
    
    # Clinical Signs
    chief_complaint: Optional[str] = Field(None, description="Primary reason for visit")
    symptoms: List[str] = Field(default_factory=list, description="List of reported symptoms")
    
    # Vitals - Nested model for better organization
    vitals: Vitals = Field(default_factory=Vitals, description="Patient vitals")
    
    # History & Diagnosis
    medical_history: List[str] = Field(default_factory=list, description="Patient's past medical conditions")
    family_history: List[str] = Field(default_factory=list, description="Family medical history")
    allergies: List[str] = Field(default_factory=list, description="Known allergies")
    
    # Diagnosis (Split)
    tentative_doctor_diagnosis: Optional[str] = Field(None, description="Diagnosis explicitly inferred or stated by the doctor")
    initial_llm_diagnosis: Optional[str] = Field(None, description="Diagnosis inferred by the AI based on symptoms/history")
    
    medications: List[str] = Field(default_factory=list, description="Prescribed medications")

    # Eligibility & Schemes
    ration_card_type: Optional[str] = Field(None, description="e.g., BPL, Antyodaya (AAY), PHH")
    income_bracket: Optional[str] = Field(None, description="Reported annual income")
    occupation: Optional[str] = Field(None, description="Primary occupation (e.g., Casual Labour, Farmer)")
    caste_category: Optional[str] = Field(None, description="SC/ST/General/OBC")
    housing_type: Optional[str] = Field(None, description="Kucha/Pucca house")
    location: Optional[str] = Field(None, description="Patient residence location/state")
    scheme_eligibility: Optional[Dict[str, Any]] = Field(None, description="Computed eligibility snapshot")

    # Metadata (Useful for Phase 2 DB storage)
    consultation_id: Optional[str] = None
    timestamp: Optional[str] = None
    transcript_summary: Optional[str] = Field(None, description="Important points from the conversation transcript")
    transcript_history: Optional[List[str]] = Field(None, description="Full conversation history for summarization (not stored)")
