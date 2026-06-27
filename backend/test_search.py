import os
import asyncio
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

async def test_search():
    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents='cari berita tentang hoaks pocong di depok turnbackhoax',
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
            )
        )
        print("Response Text:", response.text)
        print("Search Grounding Metadata:", response.candidates[0].grounding_metadata)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_search())
