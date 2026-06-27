import asyncio
import json
import httpx

async def test_stream():
    url = "http://127.0.0.1:8000/api/chat"
    payload = {
        "messages": [
            {"role": "user", "content": "apa hasil mcii saham?"}
        ],
        "model": "gemini-2.5-flash"
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            print(f"Status: {response.status_code}")
            async for chunk in response.aiter_text():
                print(f"CHUNK: {repr(chunk)}")

if __name__ == "__main__":
    asyncio.run(test_stream())
