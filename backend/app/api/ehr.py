# backend/app/api/ehr.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.core.schema import PatientData
from app.database import save_patient, update_patient, init_db, update_patient_summary

router = APIRouter()

# Initialize DB (simple approach)
init_db()

async def _generate_and_save_summary(patient_id: int, transcript_history: list[str]):
    """Background task: generates summary with retries and updates the DB record."""
    from app.services.summarizer import generate_consultation_summary_async
    try:
        summary = await generate_consultation_summary_async(transcript_history)
        if summary and summary != "Error generating summary.":
            update_patient_summary(patient_id, summary)
            print(f"Background summary saved for patient {patient_id}")
        else:
            print(f"Background summary generation failed for patient {patient_id}")
    except Exception as e:
        print(f"Background summary error: {e}")

@router.post("/commit")
async def commit_to_ehr(data: PatientData, background_tasks: BackgroundTasks):
    print(f"DEBUG: API /commit received: {data.name}")
    try:
        if data.id is not None:
            updated = update_patient(data.id, data)
            if not updated:
                raise HTTPException(status_code=404, detail=f"Patient {data.id} not found")
            return {"status": "success", "message": "Patient data updated in EHR", "patient_id": data.id, "mode": "updated"}

        patient_id = save_patient(data)
        
        # Generate summary in background (non-blocking — handles rate limits with retries)
        if data.transcript_history:
            print(f"Scheduling background summary generation for patient {patient_id}...")
            background_tasks.add_task(_generate_and_save_summary, patient_id, data.transcript_history)
        
        return {"status": "success", "message": "Patient data committed to EHR", "patient_id": patient_id, "mode": "created"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in commit_to_ehr: {e}")
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

@router.get("/patients/{patient_id}")
async def get_single_patient(patient_id: int):
    try:
        from app.database import get_patient_by_id
        patient = get_patient_by_id(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient
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
