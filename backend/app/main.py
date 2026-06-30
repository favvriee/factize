import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from .services.ai_service import analyze_chat_stream
from .services.ai_detector_service import analyze_hybrid_image
from .services.ocr_service import perform_ocr_with_fallback, verify_extracted_text

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

class VerifyKeyRequest(BaseModel):
    key: str

class VerifyTokenRequest(BaseModel):
    token: str

@app.post("/api/verify-gemini")
async def verify_gemini(request: VerifyKeyRequest):
    try:
        from google import genai
        # Uji coba sederhana untuk memvalidasi Kunci API Gemini
        client_test = genai.Client(api_key=request.key)
        client_test.models.list()
        return {"valid": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/verify-hf")
async def verify_hf(request: VerifyTokenRequest):
    try:
        import httpx
        # Uji coba autentikasi token ke API Hugging Face
        headers = {"Authorization": f"Bearer {request.token}"}
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            res = await client_http.get("https://huggingface.co/api/whoami-v2", headers=headers)
            if res.status_code == 200:
                return {"valid": True}
            else:
                raise Exception("Token tidak valid atau tidak memiliki izin akses.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest, x_gemini_api_key: Optional[str] = Header(None)):
    print(f"Menerima permintaan chat stream dengan model {request.model}.")
    return StreamingResponse(
        analyze_chat_stream(request.messages, request.model, x_gemini_api_key),
        media_type="text/event-stream"
    )

@app.post("/api/scan-image")
async def scan_image(file: UploadFile = File(...), x_hf_token: Optional[str] = Header(None)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File yang diunggah bukan gambar.")
    
    try:
        contents = await file.read()
        result = analyze_hybrid_image(contents, x_hf_token)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/verify-ocr")
async def verify_ocr(
    file: UploadFile = File(...),
    mode: str = Form("screenshot"),  # "screenshot" atau "document"
    x_gemini_api_key: Optional[str] = Header(None)
):
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Format file harus berupa gambar (PNG/JPEG) atau PDF.")
        
    try:
        contents = await file.read()
        extracted_text = perform_ocr_with_fallback(contents, file.content_type, x_gemini_api_key)
        
        if not extracted_text.strip():
            return {
                "success": False,
                "reason": "Tidak ada teks yang terdeteksi di dalam berkas ini."
            }
            
        verification_result = verify_extracted_text(extracted_text, mode, x_gemini_api_key)
        
        return {
            "success": True,
            "text": extracted_text,
            **verification_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/trending")
def get_trending():
    import json
    file_path = os.path.join(os.path.dirname(__file__), "data", "trending_hoaxes.json")
    if not os.path.exists(file_path):
        default_data = [
            {
                "id": 1,
                "title": "Tautan Pendaftaran Bansos Kemensos Google Form Rp 600rb",
                "category": "Penipuan / Scams",
                "severity": "high",
                "description": "Beredar link formulir Google/situs palsu di WhatsApp untuk mengklaim bantuan sosial tunai dari Kemensos dengan meminta foto KTP dan KK.",
                "query": "Verifikasi pesan pendaftaran bansos tunai Kemensos Rp 600.000 lewat tautan Google Form WhatsApp yang meminta data KTP."
            },
            {
                "id": 2,
                "title": "Subsidi BPJS Kesehatan Gratis Tanpa Iuran 2026",
                "category": "Finansial / Layanan Publik",
                "severity": "medium",
                "description": "Pesan berantai mengklaim pemerintah memberikan subsidi BPJS gratis untuk warga berpenghasilan rendah dengan mendaftar di situs non-resmi.",
                "query": "Cek kebenaran situs pendaftaran subsidi BPJS gratis yang meminta nomor rekening bank untuk pencairan dana bantuan."
            },
            {
                "id": 3,
                "title": "Air Kelapa & Garam Sembuhkan Demam Berdarah Instan dalam 3 Jam",
                "category": "Kesehatan / Health",
                "severity": "low",
                "description": "Postingan viral di Facebook menyatakan meminum campuran air kelapa muda dan garam dapur dapat melumpuhkan virus demam berdarah secara instan.",
                "query": "Apakah benar minum air kelapa dicampur garam dapat menyembuhkan Demam Berdarah (DBD) secara instan dalam 3 jam?"
            }
        ]
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(default_data, f, ensure_ascii=False, indent=2)
        return default_data
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membaca data tren: {str(e)}")


@app.post("/api/trending/refresh")
async def refresh_trending(x_gemini_api_key: Optional[str] = Header(None)):
    try:
        from .services.ai_service import refresh_trending_hoaxes
        updated_data = await refresh_trending_hoaxes(x_gemini_api_key)
        return {"status": "success", "data": updated_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
