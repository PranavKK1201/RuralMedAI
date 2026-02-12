
import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL_NAME = "gemini-2.0-flash" 

# Initialize via Client — standard API version for generate_content
# NOTE: v1alpha is for the Live API only (gemini_service.py). Regular generation uses the default API version.
client = genai.Client(api_key=GEMINI_API_KEY)

MAX_RETRIES = 4
INITIAL_RETRY_DELAY = 15  # seconds — Free-tier Gemini often requires ~50s cooldown

async def generate_consultation_summary_async(transcript_history: list[str]) -> str:
    """
    Generates a bulleted list of important points from the conversation transcript.
    Uses async retries with exponential backoff for 429 rate-limit errors.
    """
    if not transcript_history:
        return ""
    
    transcript_text = "\n".join(transcript_history)
    
    prompt = f"""
    You are an expert medical scribe. 
    Below is a transcript of a doctor-patient consultation.
    
    Please generate a concise "Important Points" summary.
    - Focus on clinical facts, key symptoms, diagnosis, and treatment plan.
    - Format as a bulleted list (Markdown).
    - Keep it brief but comprehensive enough to resume the session later.
    - Ignore small talk.
    
    TRANSCRIPT:
    {transcript_text}
    """
    
    for attempt in range(MAX_RETRIES):
        try:
            # Use async client for non-blocking retries
            response = await client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=prompt
            )
            print(f"Summary generated successfully on attempt {attempt + 1}")
            return response.text
        except Exception as e:
            error_str = str(e)
            print(f"Error generating summary (attempt {attempt + 1}/{MAX_RETRIES}): {error_str[:120]}")
            
            # Retry on rate limit (429) errors
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                if attempt < MAX_RETRIES - 1:
                    delay = INITIAL_RETRY_DELAY * (2 ** attempt)  # 15s, 30s, 60s, 120s
                    print(f"Rate limited. Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
            
            # Non-retryable error — fail immediately
            return "Error generating summary."
    
    return "Error generating summary."
