import os
import io
import json
from google import genai
from google.genai import types

# Coba import pypdf untuk ekstraksi PDF lokal jika tersedia
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

# Coba import pytesseract untuk ekstraksi Gambar lokal jika tersedia
try:
    import pytesseract
    from PIL import Image
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Ekstraksi teks dari PDF secara lokal menggunakan pypdf.
    Jika gagal atau pypdf tidak ada, return string kosong untuk fallback ke Gemini.
    """
    if not PYPDF_AVAILABLE:
        return ""
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = pypdf.PdfReader(pdf_file)
        text_list = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_list.append(page_text)
        return "\n".join(text_list)
    except Exception as e:
        print(f"Gagal ekstraksi PDF lokal: {e}")
        return ""

def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Ekstraksi teks dari gambar secara lokal menggunakan pytesseract jika terpasang.
    Jika tidak tersedia, return string kosong untuk fallback ke Gemini.
    """
    if not PYTESSERACT_AVAILABLE:
        return ""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(img)
    except Exception as e:
        print(f"Gagal ekstraksi gambar lokal via pytesseract: {e}")
        return ""

def perform_ocr_with_fallback(file_bytes: bytes, mime_type: str, api_key: str = None) -> str:
    """
    Mengekstrak teks dengan mencoba metode lokal terlebih dahulu.
    Jika tidak didukung/gagal, sistem menggunakan Gemini untuk mengekstrak teks secara visual.
    """
    # 1. Coba metode lokal
    extracted_text = ""
    if "pdf" in mime_type.lower():
        extracted_text = extract_text_from_pdf(file_bytes)
    else:
        extracted_text = extract_text_from_image(file_bytes)

    if extracted_text and extracted_text.strip():
        print("Teks berhasil diekstrak menggunakan pustaka lokal.")
        return extracted_text.strip()

    # 2. Fallback ke Gemini Vision/Document OCR
    print("Menggunakan fallback Gemini API untuk ekstraksi teks (OCR).")
    key_to_use = api_key if api_key else os.getenv("GEMINI_API_KEY")
    if not key_to_use:
        raise ValueError("Kunci API Gemini tidak ditemukan. Atur di pengaturan atau .env backend.")
    
    client = genai.Client(api_key=key_to_use)
    
    # Kirim file ke model Gemini 2.5 Flash
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(
                data=file_bytes,
                mime_type=mime_type,
            ),
            "Extract all readable text from this file exactly. Return only the extracted text without any summaries, comments, formatting edits, or annotations."
        ]
    )
    
    text_res = response.text or ""
    return text_res.strip()

def verify_extracted_text(text: str, mode: str, api_key: str = None) -> dict:
    """
    Menggunakan Gemini API untuk memverifikasi teks hasil ekstraksi OCR.
    Menerapkan mode 'screenshot' (untuk chat/news) atau 'document' (untuk UU/kebijakan).
    """
    key_to_use = api_key if api_key else os.getenv("GEMINI_API_KEY")
    if not key_to_use:
        raise ValueError("Kunci API Gemini tidak ditemukan.")
        
    client = genai.Client(api_key=key_to_use)
    
    if mode == "screenshot":
        system_instruction = (
            "You are Factize Screenshot Forensics Agent. Your task is to analyze the extracted text from a screenshot "
            "(which represents a digital news article headline or a chat platform screenshot like WhatsApp/Telegram). "
            "Examine if the text indicates any editorial manipulation (e.g. fake dates, fabricated headlines, modified chat logs, "
            "or rumors commonly spread in Indonesia). Check against real world facts. "
            "You must return a JSON response matching this EXACT structure (no markdown formatting, no prefix/suffix, just raw json): "
            "{\n"
            "  \"isManipulated\": true/false,\n"
            "  \"confidence\": \"92.5%\",\n"
            "  \"sourceMatch\": \"matching source title or None\",\n"
            "  \"analysis\": \"detailed explanation of the analysis, including discrepancies or fake news patterns identified in Indonesian language.\"\n"
            "}"
        )
    else:  # mode == "document"
        system_instruction = (
            "You are Factize Document Policy Verification Agent. Your task is to analyze the extracted text from a document "
            "(e.g., government official regulations, official letters, laws, or public policies in Indonesia). "
            "Assess if the clauses, text paragraphs, or statements are authentic or if they have been twisted/misrepresented/falsified. "
            "Identify missing key sections or contextual omissions. "
            "You must return a JSON response matching this EXACT structure (no markdown formatting, no prefix/suffix, just raw json): "
            "{\n"
            "  \"isManipulated\": true/false,\n"
            "  \"confidence\": \"85.0%\",\n"
            "  \"sourceMatch\": \"Official Law/Regulation Name or None\",\n"
            "  \"analysis\": \"detailed clause-by-clause or fact analysis explaining what parts are true, distorted, or edited, written in Indonesian language.\"\n"
            "}"
        )

    # Panggil Gemini
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            f"Please verify this extracted text:\n\n{text}"
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json"
        )
    )
    
    try:
        res_json = json.loads(response.text)
        return res_json
    except Exception as e:
        print(f"Failed to parse Gemini OCR JSON response: {e}, raw: {response.text}")
        import re
        is_manip = "true" in response.text.lower()
        conf_match = re.search(r'"confidence":\s*"([^"]+)"', response.text)
        src_match = re.search(r'"sourceMatch":\s*"([^"]+)"', response.text)
        analysis_match = re.search(r'"analysis":\s*"([^"]+)"', response.text)
        
        return {
            "isManipulated": is_manip,
            "confidence": conf_match.group(1) if conf_match else "75.0%",
            "sourceMatch": src_match.group(1) if src_match else "None",
            "analysis": analysis_match.group(1) if analysis_match else response.text
        }
