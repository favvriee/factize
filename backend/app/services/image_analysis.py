import io
import base64
from PIL import Image, ImageChops, ImageEnhance

def hitung_ela(image_bytes: bytes, quality: int = 75) -> dict:
    """
    Menjalankan Error Level Analysis (ELA) pada gambar.
    Menggunakan BytesIO untuk manipulasi di memori penuh (Zero-Disk Write).
    """
    try:
        # Load gambar asli dari memory
        original = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # 1. Smart Resizing (Batas maksimum 1000px agar cepat dan mengurangi noise wajar)
        max_size = 1000
        if original.width > max_size or original.height > max_size:
            original.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # 2. Simpan sementara ke memory (BytesIO) dengan kompresi (Quality 75)
        temp_io = io.BytesIO()
        original.save(temp_io, format='JPEG', quality=quality)
        temp_io.seek(0)
        
        temporary = Image.open(temp_io)
        
        # 3. Cari selisih (diff) antar piksel
        ela_image = ImageChops.difference(original, temporary)
        
        # 4. Enhance selisih agar terlihat jelas secara visual (Bumbu Penjurian)
        # Ambil nilai ekstrem untuk scaling visual
        extrema = ela_image.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        
        if max_diff == 0:
            max_diff = 1 # Hindari division by zero
            
        scale = 255.0 / max_diff
        ela_image = ImageEnhance.Brightness(ela_image).enhance(scale)
        
        # 5. Konversi ELA image ke Base64 string untuk dikirim ke frontend
        output_io = io.BytesIO()
        ela_image.save(output_io, format='JPEG', quality=95)
        ela_base64 = base64.b64encode(output_io.getvalue()).decode('utf-8')
        
        # 6. Logika threshold
        # Jika gambar AI, tingkat kompresi (error) di area generatif akan sangat berbeda
        # Nilai 45 sangat sensitif, cocok untuk mendeteksi AI yang resolusinya sangat bersih.
        if max_diff > 45:
            confidence = min(max_diff * 1.5, 99)
            return {
                "isAI": True,
                "confidence": f"{confidence:.1f}%",
                "method": "ELA",
                "reason": f"Terdeteksi anomali kompresi piksel tinggi (Max Diff: {max_diff}). Peta noise menunjukkan pola manipulasi/AI.",
                "ela_image_base64": f"data:image/jpeg;base64,{ela_base64}"
            }
        else:
            # Karena max_diff rendah, kemungkinan besar gambar asli yang konsisten kompresinya
            return {
                "isAI": False,
                "confidence": "85.0%",
                "method": "ELA",
                "reason": f"Konsistensi kompresi piksel normal (Max Diff: {max_diff}). Peta noise tampak alami tanpa jejak rekayasa berat.",
                "ela_image_base64": f"data:image/jpeg;base64,{ela_base64}"
            }

    except Exception as e:
        print(f"Error pada proses ELA: {e}")
        return {
            "isAI": False,
            "confidence": "0%",
            "method": "ELA",
            "reason": "Gagal memproses gambar untuk ELA.",
            "ela_image_base64": None
        }
