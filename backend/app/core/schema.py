# backend/app/core/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional

class Vitals(BaseModel):
    temperature: Optional[str] = Field(None, description="Body Temperature (e.g., 98.6 F)")
    blood_pressure: Optional[str] = Field(None, description="Blood Pressure (e.g., 120/80 mmHg)")
    pulse: Optional[int] = Field(None, description="Heart Rate in BPM")
    spo2: Optional[int] = Field(None, description="Oxygen Saturation in %")
    respiratory_rate: Optional[int] = Field(None, description="Breaths per minute")

class PatientData(BaseModel):
    # Demographics
    name: Optional[str] = Field(None, description="Patient's full name")
    age: Optional[int] = Field(None, description="Patient's age in years")
    gender: Optional[str] = Field(None, description="Patient's gender (Male/Female/Other)")
    
    # Clinical Signs
    chief_complaint: Optional[str] = Field(None, description="Primary reason for visit")
    symptoms: List[str] = Field(default_factory=list, description="List of reported symptoms")
    
    # Vitals - Nested model for better organization
    vitals: Vitals = Field(default_factory=Vitals, description="Patient vitals")
    
    # History & Diagnosis
    medical_history: List[str] = Field(default_factory=list, description="Past medical conditions")
    allergies: List[str] = Field(default_factory=list, description="Known allergies")
    
    # Diagnosis (Split)
    tentative_doctor_diagnosis: Optional[str] = Field(None, description="Diagnosis explicitly inferred or stated by the doctor")
    initial_llm_diagnosis: Optional[str] = Field(None, description="Diagnosis inferred by the AI based on symptoms/history")
    
    medications: List[str] = Field(default_factory=list, description="Prescribed medications")

    # Metadata (Useful for Phase 2 DB storage)
    consultation_id: Optional[str] = None
    timestamp: Optional[str] = None