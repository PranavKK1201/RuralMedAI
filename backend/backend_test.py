import psycopg2

query = '''
        INSERT INTO patients (
            name, age, gender, chief_complaint, symptoms, 
            temp, bp, pulse, spo2,
            medical_history, family_history, allergies, 
            tentative_doctor_diagnosis, initial_llm_diagnosis,
            medications, transcript_summary,
            ration_card_type, income_bracket, occupation, caste_category, housing_type, location, scheme_eligibility
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
'''

try:    
    args = tuple([f"var_{i}" for i in range(23)])
    print(query % args)
except Exception as e:
    print(e)
