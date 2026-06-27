import asyncio
from app.services.ai_service import analyze_chat_stream

class MockMsg:
    def __init__(self):
        self.role = "user"
        self.content = "hi"
        self.attachments = []

async def test():
    async for chunk in analyze_chat_stream([MockMsg()]):
        print(chunk)

if __name__ == "__main__":
    asyncio.run(test())
