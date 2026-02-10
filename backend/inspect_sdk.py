
import google.genai.types as types
from google.genai import Client
import inspect

print("--- Types in google.genai.types ---")
for name in dir(types):
    if "Tool" in name or "Response" in name:
        print(name)

print("\n--- Examining AsyncSession.send signature ---")
# We can't easily instantiate AsyncSession without connecting, but we can check the module if we can import it.
# It's likely in google.genai.live
try:
    from google.genai import live
    print("Found google.genai.live")
except ImportError:
    print("Could not import google.genai.live")

