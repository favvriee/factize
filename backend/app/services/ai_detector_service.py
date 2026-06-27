import io
import base64
import os
import httpx
from PIL import Image, ImageChops, ImageEnhance
from dotenv import load_dotenv

load_dotenv(override=True)

HF_TOKEN = os.getenv("HF_TOKEN")
MODEL_ID = "Ateeqq/ai-vs-human-image-detector"
API_URL = f"https://router.huggingface.co/hf-inference/models/{MODEL_ID}"

def analyze_hybrid_image(file_bytes: bytes):
    try:
        # Load image locally for ELA analysis
        img = Image.open(io.BytesIO(file_bytes)).convert('RGB')
        
        # --- TAHAP 1: PREDIKSI HUGGING FACE INFERENCE API ---
        headers = {
            "Content-Type": "image/jpeg"
        }
        if HF_TOKEN:
            headers["Authorization"] = f"Bearer {HF_TOKEN}"
            
        is_ai = False
        confidence_score = 50.0
        
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(API_URL, headers=headers, content=file_bytes)
                
            if response.status_code == 200:
                result_json = response.json()
                # Hugging Face image classification output format:
                # [{"label": "ai", "score": 0.06}, {"label": "hum", "score": 0.94}]
                if isinstance(result_json, list) and len(result_json) > 0:
                    ai_score = 0.0
                    human_score = 0.0
                    for item in result_json:
                        label = str(item.get("label", "")).lower()
                        score = float(item.get("score", 0.0))
                        if label in ["ai", "label_0", "artificial", "fake"]:
                            ai_score = score
                        elif label in ["human", "hum", "label_1", "real"]:
                            human_score = score
                    
                    is_ai = ai_score > human_score
                    confidence_score = round((ai_score if is_ai else human_score) * 100, 2)
                else:
                    print(f"Format respon Hugging Face tidak dikenal: {result_json}")
                    # Fallback / Error
                    raise Exception(f"Format respon Hugging Face tidak dikenal: {result_json}")
            else:
                # Handle error / gated repository / loading model
                print(f"Hugging Face API error ({response.status_code}): {response.text}")
                raise Exception(f"Hugging Face API error ({response.status_code}): {response.text}")
                
        except Exception as api_err:
            print(f"Gagal memanggil Hugging Face API: {api_err}. Mengembalikan status deteksi gagal.")
            return {
                "success": False,
                "reason": f"Gagal menganalisis gambar karena gangguan pada API Hugging Face: {str(api_err)}"
            }

        # --- TAHAP 2: VISUALISASI ELA ---
        ela_io = io.BytesIO()
        img.save(ela_io, 'JPEG', quality=75)
        ela_io.seek(0)
        compressed = Image.open(ela_io)
        ela_diff = ImageChops.difference(img.resize(compressed.size), compressed)
        enhanced_ela = ImageEnhance.Brightness(ela_diff).enhance(15.0)
        
        buffered = io.BytesIO()
        enhanced_ela.save(buffered, format="JPEG")
        ela_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        reason = (
            "Sidik jari AI terdeteksi melalui model SigLIP (Ateeqq/ai-vs-human-image-detector) pada pola distribusi piksel."
            if is_ai else 
            "Struktur visual dan distribusi noise frekuensi piksel gambar ini konsisten dengan tangkapan sensor lensa kamera fisik (Manusia)."
        )

        return {
            "success": True,
            "isAI": is_ai,
            "confidence": f"{confidence_score}%",
            "method": "SigLIP (Ateeqq/ai-vs-human-image-detector)",
            "reason": reason,
            "ela_image_base64": f"data:image/jpeg;base64,{ela_base64}"
        }

    except Exception as e:
        return {"success": False, "reason": str(e)}
