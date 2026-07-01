import os
from google import genai
from google.genai import types

def get_api_keys(custom_api_key=None):
    """
    Mengembalikan daftar API key yang valid secara berurutan.
    Kunci kustom ditempatkan di paling depan jika disediakan oleh client.
    """
    keys = []
    if custom_api_key:
        keys.append(custom_api_key)
        
    # Ambil kunci dari environment (mendukung key utama dan cadangan)
    for name in ["GEMINI_API_KEY", "GEMINI_API_KEY1", "GEMINI_API_KEY2", "GEMINI_API_KEY3"]:
        val = os.getenv(name)
        if val and val != "your_gemini_api_key_here" and val not in keys:
            keys.append(val)
            
    return keys

async def generate_content_with_failover(contents, config=None, model='gemini-2.5-flash', custom_api_key=None):
    """
    Menjalankan generate_content secara ASYNC dengan rotasi kunci otomatis jika terjadi kegagalan.
    """
    keys = get_api_keys(custom_api_key)
    if not keys:
        raise Exception("Tidak ada Kunci API Gemini yang tersedia di server.")
        
    last_err = None
    for idx, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            print(f"[Gemini API Async] Sukses menggunakan Kunci API ke-{idx+1}")
            return response
        except Exception as e:
            print(f"[Gemini API Async Failover] Kunci API ke-{idx+1} gagal: {e}")
            last_err = e
            continue
            
    raise last_err

async def generate_content_stream_with_failover(contents, config=None, model='gemini-2.5-flash', custom_api_key=None):
    """
    Menjalankan generate_content_stream secara ASYNC dengan rotasi kunci otomatis.
    Menggunakan pre-fetching chunk pertama untuk mendeteksi error limit (429) sejak awal.
    """
    keys = get_api_keys(custom_api_key)
    if not keys:
        raise Exception("Tidak ada Kunci API Gemini yang tersedia di server.")
        
    last_err = None
    for idx, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=60_000))
            stream = await client.aio.models.generate_content_stream(
                model=model,
                contents=contents,
                config=config
            )
            # Uji inisiasi stream dengan memicu fetch chunk pertama
            stream_iter = stream.__aiter__()
            first_chunk = await stream_iter.__anext__()
            
            # Jika berhasil, buat wrapper generator untuk menyalurkan first_chunk lalu sisa stream
            async def stream_wrapper():
                yield first_chunk
                async for chunk in stream_iter:
                    yield chunk
            
            print(f"[Gemini API Stream] Inisiasi & uji sukses menggunakan Kunci API ke-{idx+1}")
            return stream_wrapper()
        except StopAsyncIteration:
            # Kasus stream kosong (sukses tapi tidak ada data)
            async def empty_stream():
                if False:
                    yield None
            return empty_stream()
        except Exception as e:
            print(f"[Gemini API Stream Failover] Kunci API ke-{idx+1} gagal saat inisiasi/uji: {e}")
            last_err = e
            continue
            
    raise last_err

def generate_content_sync_with_failover(contents, config=None, model='gemini-2.5-flash', custom_api_key=None):
    """
    Menjalankan generate_content secara SYNC dengan rotasi kunci otomatis.
    """
    keys = get_api_keys(custom_api_key)
    if not keys:
        raise Exception("Tidak ada Kunci API Gemini yang tersedia di server.")
        
    last_err = None
    for idx, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=60_000))
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            print(f"[Gemini API Sync] Sukses menggunakan Kunci API ke-{idx+1}")
            return response
        except Exception as e:
            print(f"[Gemini API Sync Failover] Kunci API ke-{idx+1} gagal: {e}")
            last_err = e
            continue
            
    raise last_err
