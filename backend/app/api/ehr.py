# backend/app/api/ehr.py
from fastapi import APIRouter, HTTPException
from app.core.schema import PatientData
from app.database import save_patient, update_patient, init_db

router = APIRouter()

# Initialize DB (simple approach)
init_db()

@router.post("/commit")
async def commit_to_ehr(data: PatientData):
    print(f"DEBUG: API /commit received: {data}")
    try:
        if data.id is not None:
            updated = update_patient(data.id, data)
            if not updated:
                raise HTTPException(status_code=404, detail=f"Patient {data.id} not found")
            return {"status": "success", "message": "Patient data updated in EHR", "patient_id": data.id, "mode": "updated"}

        patient_id = save_patient(data)
        return {"status": "success", "message": "Patient data committed to EHR", "patient_id": patient_id, "mode": "created"}
    except HTTPException:
        raise
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

@router.put("/patients/{patient_id}")
async def update_patient_endpoint(patient_id: int, data: PatientData):
    try:
        updated = update_patient(patient_id, data)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        return {"status": "success", "message": f"Patient {patient_id} updated", "patient_id": patient_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/patients/{patient_id}")
async def delete_patient_endpoint(patient_id: int):
    try:
        from app.database import delete_patient
        delete_patient(patient_id)
        return {"status": "success", "message": f"Patient {patient_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
