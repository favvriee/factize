import asyncio
import httpx

async def test_stream():
    url = "http://127.0.0.1:8001/api/chat"
    payload = {
        "messages": [
            {"role": "user", "content": "Cek link berita ini: https://news.detik.com/berita/d-8460541/geger-geden-pocong-keliling-teror-rumah-warga-di-depok-ternyata-hoax"}
        ],
        "model": "gemini-2.5-flash"
    }
    
    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=payload) as response:
            print(f"Status: {response.status_code}")
            async for chunk in response.aiter_text():
                print(f"[{chunk}]")

if __name__ == "__main__":
    asyncio.run(test_stream())
