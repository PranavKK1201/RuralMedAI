
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    # Try the other one just in case
    api_key = os.getenv("GEMINI_API_KEY")

print(f"API Key present: {bool(api_key)}")

try:
    client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    # Trying v1alpha as Live API is often in alpha/beta
    
    print("Listing models...")
    for m in client.models.list():
        print(f"Model: {m.name}")
        print(f"  Supported generation methods: {m.supported_generation_methods}")
        
except Exception as e:
    print(f"Error listing models: {e}")

print("-" * 20)
try:
    # Try with default client (v1beta usually)
    client_v1 = genai.Client(api_key=api_key)
    print("Listing models (default client)...")
    for m in client_v1.models.list():
        print(f"Model: {m.name}")
        if hasattr(m, 'supported_generation_methods'):
             print(f"  Supported generation methods: {m.supported_generation_methods}")
except Exception as e:
    print(f"Error listing models with default client: {e}")
