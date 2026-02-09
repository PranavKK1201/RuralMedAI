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
            age INTEGER,
            gender TEXT,
            chief_complaint TEXT,
            symptoms TEXT, -- JSON
            temp TEXT,
            bp TEXT,
            pulse INTEGER,
            spo2 INTEGER,
            respiratory_rate INTEGER,
            medical_history TEXT, -- JSON
            allergies TEXT, -- JSON
            diagnosis TEXT,
            medications TEXT, -- JSON
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_patient(data: PatientData):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # helper for json list dumps
    def to_json(val):
        return json.dumps(val) if val else "[]"
    
    cursor.execute('''
        INSERT INTO patients (
            name, age, gender, chief_complaint, symptoms, 
            temp, bp, pulse, spo2, respiratory_rate,
            medical_history, allergies, diagnosis, medications
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.name,
        data.age,
        data.gender,
        data.chief_complaint,
        to_json(data.symptoms),
        data.vitals.temperature,
        data.vitals.blood_pressure,
        data.vitals.pulse,
        data.vitals.spo2,
        data.vitals.respiratory_rate,
        to_json(data.medical_history),
        to_json(data.allergies),
        data.diagnosis,
        to_json(data.medications)
    ))
    
    
    patient_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return patient_id

def get_all_patients():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM patients ORDER BY created_at DESC')
    rows = cursor.fetchall()
            
    # Convert Row objects to dicts and parse JSON strings
    patients = []
    for row in rows:
        p = dict(row)
        for json_field in ['symptoms', 'medical_history', 'allergies', 'medications']:
            if p.get(json_field):
                try:
                    p[json_field] = json.loads(p[json_field])
                except:
                    p[json_field] = []
        patients.append(p)
    
    conn.close()
    return patients
