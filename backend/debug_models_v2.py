
import os
from dotenv import load_dotenv
from google import genai
import sys

# Force explicit flushing for real-time output
sys.stdout.reconfigure(line_buffering=True)

load_dotenv()

# Check both keys
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    api_key = os.getenv("GEMINI_API_KEY")

print(f"DEBUG: Using API Key starting with: {api_key[:4] if api_key else 'None'}")

try:
    # Try explicitly with v1alpha as Multimodal Live is often gated there
    print("\n--- Listing Models (v1alpha) ---")
    client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    
    for m in client.models.list():
        # filter for flash/2.0 to keep output manageable
        if 'flash' in m.name or '2.0' in m.name or 'gemini' in m.name:
            print(f"Model ID: {m.name}")
            # print(f"  Methods: {m.supported_generation_methods}")
            if "bidiGenerateContent" in m.supported_generation_methods:
                print(f"  *** SUPPORTS LIVE API (bidiGenerateContent) ***")
            
except Exception as e:
    print(f"Error v1alpha: {e}")

try:
    print("\n--- Listing Models (v1beta) ---")
    client_v1 = genai.Client(api_key=api_key, http_options={'api_version': 'v1beta'})
    for m in client_v1.models.list():
         if 'flash' in m.name or '2.0' in m.name or 'gemini' in m.name:
            print(f"Model ID: {m.name}")
            if hasattr(m, 'supported_generation_methods') and "bidiGenerateContent" in m.supported_generation_methods:
                print(f"  *** SUPPORTS LIVE API (bidiGenerateContent) ***")

except Exception as e:
    print(f"Error v1beta: {e}")
