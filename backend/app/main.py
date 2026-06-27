import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from .services.ai_service import analyze_chat_stream
from .services.ai_detector_service import analyze_hybrid_image

app = FastAPI(title="si-FAKTA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Attachment(BaseModel):
    name: str
    type: str
    data: Optional[str] = None # Base64 string

class Message(BaseModel):
    role: str
    content: str
    attachments: Optional[List[Attachment]] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = 'gemini-2.5-flash'

@app.get("/")
def read_root():
    return {"message": "Welcome to si-FAKTA API"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    print(f"Menerima permintaan chat stream dengan model {request.model}.")
    return StreamingResponse(
        analyze_chat_stream(request.messages, request.model),
        media_type="text/event-stream"
    )

@app.post("/api/scan-image")
async def scan_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File yang diunggah bukan gambar.")
    
    try:
        contents = await file.read()
        result = analyze_hybrid_image(contents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
