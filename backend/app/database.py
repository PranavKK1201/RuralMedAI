# backend/app/database.py
import sqlite3
import json
from app.core.schema import PatientData

DB_NAME = "ruralmed.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            age TEXT,
            gender TEXT,
            chief_complaint TEXT,
            symptoms TEXT, -- JSON
            temp TEXT,
            bp TEXT,
            pulse TEXT,
            spo2 TEXT,
            medical_history TEXT, -- JSON
            family_history TEXT, -- JSON
            allergies TEXT, -- JSON
            tentative_doctor_diagnosis TEXT,
            initial_llm_diagnosis TEXT,
            medications TEXT, -- JSON
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Migration for existing databases
    try:
        cursor.execute("ALTER TABLE patients ADD COLUMN tentative_doctor_diagnosis TEXT")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE patients ADD COLUMN initial_llm_diagnosis TEXT")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE patients ADD COLUMN family_history TEXT")
    except sqlite3.OperationalError: pass

    conn.commit()
    conn.close()

def save_patient(data: PatientData):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # helper for json list dumps
    def to_json(val):
        return json.dumps(val) if val else "[]"
    
    # Safely get vitals from Pydantic model
    v = data.vitals
    print(f"DEBUG: save_patient received data.vitals: {v}")
    print(f"DEBUG: save_patient full data: {data.model_dump_json()}")
    
    cursor.execute('''
        INSERT INTO patients (
            name, age, gender, chief_complaint, symptoms, 
            temp, bp, pulse, spo2,
            medical_history, family_history, allergies, 
            tentative_doctor_diagnosis, initial_llm_diagnosis,
            medications
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.name,
        data.age,
        data.gender,
        data.chief_complaint,
        to_json(data.symptoms),
        v.temperature if v else None,
        v.blood_pressure if v else None,
        v.pulse if v else None,
        v.spo2 if v else None,
        to_json(data.medical_history),
        to_json(data.family_history),
        to_json(data.allergies),
        data.tentative_doctor_diagnosis,
        data.initial_llm_diagnosis,
        to_json(data.medications)
    ))
    
    patient_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return patient_id

def delete_patient(patient_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM patients WHERE id = ?', (patient_id,))
    conn.commit()
    conn.close()

def get_all_patients():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM patients ORDER BY created_at DESC')
    rows = cursor.fetchall()
            
    # Convert Row objects to dicts and parse JSON strings
    patients = []
    for row in rows:
        p = dict(row)
        for json_field in ['symptoms', 'medical_history', 'family_history', 'allergies', 'medications']:
            if p.get(json_field):
                try:
                    p[json_field] = json.loads(p[json_field])
                except:
                    p[json_field] = []
        patients.append(p)
    
    conn.close()
    return patients
