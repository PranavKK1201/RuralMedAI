# backend/app/api/ehr.py
from fastapi import APIRouter, HTTPException
from app.core.schema import PatientData
from app.database import save_patient, init_db

router = APIRouter()

# Initialize DB (simple approach)
init_db()

@router.post("/commit")
async def commit_to_ehr(data: PatientData):
    try:
        patient_id = save_patient(data)
        return {"status": "success", "message": "Patient data committed to EHR", "patient_id": patient_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patients")
async def get_patients():
    try:
        from app.database import get_all_patients
        patients = get_all_patients()
        return patients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
