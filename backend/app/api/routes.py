from fastapi import APIRouter, HTTPException
from app.core.schema import PatientData # Note: User named it 'schema.py' not 'schemas.py'
import datetime

router = APIRouter()

@router.post("/generate-note")
async def generate_clinical_note(data: PatientData):
    """
    Receives structured PatientData and returns a formatted clinical note usually for the doctor to review/print.
    """
    try:
        # Simple rule-based generation for POC (Phase 1)
        # In Phase 2, this could also use an LLM for better styling
        
        note = f"""
RURALMED AI - CLINICAL NOTE
Date: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}
--------------------------------------------------
PATIENT DETAILS
Name: {data.name or "N/A"}
Age: {data.age or "N/A"} | Gender: {data.gender or "N/A"}

CHIEF COMPLAINT
{data.chief_complaint or "Not recorded"}

VITALS
BP: {data.vitals.blood_pressure or "N/A"}
Pulse: {data.vitals.pulse or "N/A"} bpm
Temp: {data.vitals.temperature or "N/A"}
SpO2: {data.vitals.spo2 or "N/A"}%

SYMPTOMS
{", ".join(data.symptoms) if data.symptoms else "None reported"}

DIAGNOSIS
{data.diagnosis or "Pending"}

MEDICATIONS
{", ".join(data.medications) if data.medications else "None prescribed"}
--------------------------------------------------
"""
        return {"note": note.strip()}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
