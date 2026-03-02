import sys
import os

# Set up environment
os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/ruralmed"
os.environ["AES_256_KEY"] = "xG0qV6zQ7m7s9B4Z2v0uK3YyN5cJtWlR8pH1dEoFaQ8="

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import save_patient, init_db
from app.core.schema import PatientData

init_db()

# Construct patient data based on user payload
data = PatientData(
    id=None, name="Pranav", age="21", gender="male", chief_complaint="high fever",
    symptoms=["high fever", "soreness in feet"],
    vitals={"temperature": "20 degrees Celsius", "blood_pressure": None, "pulse": None, "spo2": None},
    medical_history=["diabetes"], family_history=[], allergies=[],
    tentative_doctor_diagnosis="common cold", initial_llm_diagnosis=None,
    medications=[], ration_card_type="no ration card", income_bracket=None, occupation="farmer",
    caste_category=None, housing_type="pucca", location=None, scheme_eligibility=None,
    consultation_id=None, timestamp=None, transcript_summary=None, transcript_history=None
)

try:
    save_patient(data)
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
