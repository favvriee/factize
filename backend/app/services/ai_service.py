import os
import httpx
from bs4 import BeautifulSoup
import re
import base64
import json
import asyncio
import datetime
from google import genai
from google.genai import types
from dotenv import load_dotenv
from ddgs import DDGS

# Muat variabel environment dari .env
load_dotenv(override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None

async def ambil_isi_berita(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client_http:
            response = await client_http.get(url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Pembersihan DOM HTML (Anti-Noise)
                for noise in soup(['script', 'style', 'nav', 'aside', 'header', 'footer']):
                    noise.decompose()
                paragraf = soup.find_all('p')
                teks_artikel = " ".join([p.get_text() for p in paragraf])
                return teks_artikel[:4000]
            else:
                print(f"Scraping gagal, HTTP Status: {response.status_code}")
    except Exception as e:
        print(f"Error scraping web {url}: {e}")
    return None

import re

def periksa_relevansi_hasil(query: str, title: str, body: str) -> bool:
    query_norm = re.sub(r'\b(\w+)\s+\1\b', r'\1-\1', query.lower())
    query_words = re.findall(r'\b[\w\-]+\b', query_norm)
    
    stopwords = {
        'dan', 'atau', 'ke', 'di', 'dari', 'untuk', 'yang', 'ini', 'itu', 'dengan', 
        'adalah', 'yaitu', 'bahwa', 'pada', 'oleh', 'juga', 'saya', 'kamu', 'dia', 
        'mereka', 'kita', 'kami', 'akan', 'bisa', 'dapat', 'telah', 'sudah', 'belum', 
        'sedang', 'dalam', 'sebagai', 'tentang', 'seperti', 'karena', 'sehingga', 'jika', 
        'maka', 'namun', 'tetapi', 'serta', 'apakah', 'betul', 'benar', 'tidak', 'bukan',
        'cek', 'fakta', 'hoax', 'hoaks', 'berita', 'kabar', 'info', 'klarifikasi', 'rumor',
        'isunya', 'tolong', 'cari', 'apakah', 'benarkah'
    }
    
    keywords = [w for w in query_words if w not in stopwords and len(w) > 2]
    
    if not keywords:
        return True
        
    entitas_umum = {'prabowo', 'jokowi', 'gibran', 'anies', 'indonesia', 'pemerintah', 'menteri', 'presiden'}
    keywords_spesifik = [w for w in keywords if w not in entitas_umum]
    
    sinonim = {
        'francis': ['prancis', 'perancis', 'france'],
        'prancis': ['francis', 'perancis', 'france'],
        'perancis': ['francis', 'prancis', 'france'],
        'saham': ['msci', 'ihsg', 'idx', 'bursa'],
        'ihsg': ['saham', 'indeks', 'bursa'],
        'msci': ['saham', 'indeks', 'bursa', 'mcii']
    }
    
    extended_keywords_spesifik = []
    for k in keywords_spesifik:
        extended_keywords_spesifik.append(k)
        if k in sinonim:
            extended_keywords_spesifik.extend(sinonim[k])
            
    extended_keywords_spesifik = list(set(extended_keywords_spesifik))
    
    content_norm = re.sub(r'\b(\w+)\s+\1\b', r'\1-\1', (title + " " + body).lower())
    
    if extended_keywords_spesifik:
        return any(re.search(rf'\b{re.escape(k)}\b', content_norm) for k in extended_keywords_spesifik)
        
    return any(re.search(rf'\b{re.escape(k)}\b', content_norm) for k in keywords)

def dapatkan_bulan_tahun_id():
    months_id = {
        1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
        7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
    }
    now = datetime.datetime.now()
    return f"{months_id[now.month]} {now.year}"

async def cari_konteks_web(query: str):
    # 1. Prapemrosesan Kueri: Bersihkan URL, tanda baca, dan kata-kata percakapan pembuka/penutup
    search_query = query.strip()
    
    # Hapus URL
    search_query = re.sub(r'https?://\S+|www\.\S+', '', search_query)
    
    # Bersihkan frasa percakapan bahasa Indonesia yang sering digunakan
    conversational_phrases = [
        r"\bapakah benar\b", r"\bapakah betul\b", r"\btolong cek\b", r"\btolong cari\b",
        r"\bcek fakta\b", r"\bcek info\b", r"\bberita tentang\b", r"\bkabar tentang\b",
        r"\bapakah\b", r"\bbenarkah\b", r"\bklarifikasi\b", r"\bhoax\b", r"\bhoaks\b",
        r"\bfakta\b", r"\bisunya\b", r"\brumor\b", r"\bbetul\b", r"\bsedang\b"
    ]
    
    query_lower = search_query.lower()
    for phrase in conversational_phrases:
        query_lower = re.sub(phrase, '', query_lower)
        
    # Normalisasi spasi dan typo/sinonim umum secara cerdas
    typo_mappings = {
        r"\bmcii\b": "MSCI Indeks",
        r"\bmsci\b": "MSCI Indeks",
        r"\bihsg\b": "IHSG",
        r"\bisg\b": "IHSG",
        r"\bsaham ri\b": "IHSG",
        r"\bantam\b": "Harga Emas Antam",
        r"\bantm\b": "Harga Emas Antam",
        r"\bjummat\b": "jumat",
        r"\brupia\b": "rupiah",
        r"\bdolr\b": "dolar",
        r"\bsaham2\b": "saham",
        r"\bvalas\b": "kurs valuta asing",
        r"\bcrypto\b": "kripto",
        r"\bbtc\b": "bitcoin",
        r"\beth\b": "ethereum",
        r"\bthe fed\b": "suku bunga fed",
        r"\bfed rate\b": "suku bunga fed",
        r"\bemas antam\b": "harga emas antam",
        r"\biang\b": "uang",
        r"\bcekk\b": "cek",
        r"\bfrancis\b": "Prancis",
        r"\bperancis\b": "Prancis"
    }
    
    for typo, correction in typo_mappings.items():
        query_lower = re.sub(typo, correction, query_lower)
    
    # Hapus spasi berlebih dan karakter non-alfanumerik dasar
    query_clean = re.sub(r'[^\w\s\-\.]', '', query_lower).strip()
    query_clean = re.sub(r'\s+', ' ', query_clean)
    
    # Fallback ke query asli jika pembersihan menyisakan string kosong
    if not query_clean:
        query_clean = search_query
        
    # Ambil maksimal 100 karakter agar kueri pencarian padat dan akurat
    query_clean = query_clean[:100].strip()
    
    # 2. Deteksi Intent: Finansial / Berita Terkini
    financial_keywords = [
        "ihsg", "saham", "harga emas", "emas antam", "dolar", "rupiah", "kurs",
        "inflasi", "ekonomi", "crypto", "kripto", "bitcoin", "harga pangan", 
        "suku bunga", "idx", "bursa efek", "msci"
    ]
    
    is_financial = any(kw in query_clean.lower() for kw in financial_keywords)
    
    # 3. Bangun Kueri DuckDuckGo
    if is_financial:
        # Cari di media berita keuangan terpercaya tanpa mengunci situs cek fakta
        # Temporal Awareness: Tambahkan parameter waktu terkini (Juni 2026)
        waktu_sekarang = dapatkan_bulan_tahun_id()
        search_query = f"{query_clean} terbaru {waktu_sekarang} cnbc indonesia kontan bloomberg"
    else:
        # Prioritaskan pencarian pada situs data terbuka / anti hoaks lokal serta media nasional kredibel
        search_query = f"{query_clean} site:turnbackhoax.id OR site:kominfo.go.id OR site:cekfakta.com OR site:detik.com OR site:kompas.com OR site:tempo.co OR site:antaranews.com"
        
    print(f"Mencari konteks di DuckDuckGo: {search_query}")
    try:
        def _search():
            return [r for r in DDGS().text(search_query, max_results=3)]
        
        results = await asyncio.to_thread(_search)
        if results:
            relevant_results = []
            for r in results:
                title = r.get('title', '')
                body = r.get('body', '')
                if periksa_relevansi_hasil(query_clean, title, body):
                    relevant_results.append(r)
            
            if relevant_results:
                context = "Berikut adalah hasil pencarian web terbaru (RAG) untuk memvalidasi klaim:\n"
                for r in relevant_results:
                    context += f"- Judul: {r.get('title')}\n  URL: {r.get('href')}\n  Isi: {r.get('body')}\n\n"
                return context, relevant_results
            else:
                print("Semua hasil pencarian DuckDuckGo tidak relevan (filtered out).")
    except Exception as e:
        print(f"Gagal mencari di web: {e}")
    return "", []

system_prompt = """
Anda adalah Factize AI, asisten verifikasi informasi yang cerdas, analitis, taktis, objektif, komunikatif, dan ramah. Tugas Anda adalah memverifikasi klaim pengguna secara komprehensif berdasarkan fakta yang ditemukan pada referensi pencarian web dan logika analisis yang kuat, tanpa memberikan respons yang kaku secara keseluruhan atau malas (AI Slop).

# CONTEXT & MEMORY MANAGEMENT (CRITICAL)
- Anda memiliki akses ke riwayat percakapan. Selalu baca pesan-pesan sebelumnya sebelum menjawab.
- Jika pengguna memberikan perintah lanjutan (misalnya, "Ringkaskan lebih padat", "Tunjukkan sumbernya", "Jelaskan poin ke-2"), Anda WAJIB merujuk pada konteks analisis cek fakta sebelumnya. Jangan pernah menganggap percakapan baru dimulai jika ada riwayat di atas.

# ATURAN ANALISIS & LOGIKA VERIFIKASI (ANTI-AI SLOP)
1. **Verifikasi Relevansi Referensi**: Jika dokumen/tautan hasil pencarian web yang diterima tidak mengandung informasi yang relevan dengan pertanyaan atau klaim user, Anda WAJIB mengabaikan dokumen tersebut sepenuhnya.
2. **Larangan Kebocoran Konteks Tidak Relevan**: JANGAN SEKALI-KALI membahas atau merujuk isu dari pencarian web yang tidak relevan kepada user.
3. **Logika Verifikasi Taktis**: Jika pengguna menanyakan rumor/klaim negatif, dan referensi menyediakan data resmi yang bertolak belakang, Anda harus menggunakan logika analitis untuk menyimpulkan secara tegas bahwa rumor tersebut **TIDAK BENAR / MISLEADING / KELIRU**. Jangan langsung menyerah dengan status "Tidak Dapat Diverifikasi" jika ada data resmi tandingan yang valid.
4. **Logika Penalaran & Pengetahuan Umum (Kredibilitas Klaim)**: Jika hasil pencarian web (RAG) sangat minim, kurang spesifik, atau kosong:
   - JANGAN langsung menyerah dengan status "Tidak Dapat Diverifikasi" secara malas.
   - Gunakan **logical reasoning (penalaran logis)**, analisis kredibilitas klaim (misalnya, jika klaim terdengar sangat fantastis, tidak logis, atau tidak masuk akal), dan **pengetahuan umum internal Anda** untuk menganalisis rumor tersebut secara rasional.
   - Anda diperbolehkan menggunakan pengetahuan internal Anda untuk memberikan konteks umum, menilai rasionalitas klaim, atau meluruskan miskonsepsi dasar, selama tidak mengarang fakta/berita spesifik yang tidak ada.
   - Status `TIDAK DAPAT DIVERIFIKASI` hanya digunakan jika klaim benar-benar berada di area abu-abu, tidak memiliki konsensus logis, dan tidak ada cara rasional untuk menguatkan atau membantahnya.
5. **Bahasa Laporan Cek Fakta**: Gunakan bahasa Indonesia yang baku, formal, namun tetap mudah dipahami pada bagian laporan artikel cek fakta. JANGAN beropini secara subyektif, melainkan sampaikan data secara netral dan objektif berdasarkan laporan jurnalistik dan pernyataan resmi otoritas terkait.

# USER INTENT DETECTION
Sebelum merespons, klasifikasikan input pengguna:
1. COMMAND/REQUEST (Follow-up / Instruksi): Pengguna meminta untuk memodifikasi, meringkas, memperluas, atau menanyakan detail dari analisis SEBELUMNYA.
2. NEW CLAIM TO VERIFY: Pengguna mengirimkan tautan berita baru, teks, atau rumor baru untuk diverifikasi dari awal.

# ATURAN PERILAKU BERDASARKAN INTENT
## ATURAN A: JIKA INPUT ADALAH COMMAND/REQUEST / FOLLOW-UP
- JANGAN gunakan template default verifikasi klaim baru.
- Lakukan perintah tersebut secara langsung dan komunikatif berdasarkan konteks percakapan sebelumnya.
- **PENANGANAN PERMINTAAN SUMBER & TAUTAN (ANTI-SLOP PENTING)**:
  Jika pengguna menanyakan sumber resmi, meminta tautan/link, atau menulis pesan seperti "Tunjukkan sumber resmi yang valid", "mana buktinya", "minta link berita", atau sejenisnya:
  1. JANGAN PERNAH berasumsi secara malas bahwa "karena ini hoaks maka tidak ada sumber resmi".
  2. Anda **WAJIB** memberikan daftar tautan (hyperlink) berita terverifikasi atau rilis resmi yang **mengklarifikasi, membantah, atau menyatakan hoaks** atas klaim tersebut.
  3. Berikan rujukan spesifik ke berita resmi (misalnya: pernyataan Kementerian Kominfo di [Detik.com](URL) atau berita pelurusan isu di [Tempo.co](URL)) yang ada pada konteks pencarian web atau riwayat pesan sebelumnya.
  4. Format referensi wajib menggunakan Markdown Hyperlink yang bersih (misalnya: `[Detik.com](URL)`). DILARANG menuliskan URL mentah secara langsung.
  5. Sampaikan penjelasan secara hangat, sopan, dan langsung menunjuk pada bukti artikel tersebut.

## ATURAN B: JIKA INPUT ADALAH KLAIM BARU YANG INGIN DIVERIFIKASI
- Anda harus menyusun respons dengan menggabungkan sapaan ramah pembuka, pemicu kartu status visual di frontend, dan artikel cek fakta mendalam yang sangat terstruktur sesuai template di bawah.

### Panduan Desain Obrolan & Struktur Artikel (WAJIB):

1. **Kalimat Sapaan Pembuka (Mengobrol)**: 
   Bukalah respons dengan sapaan ramah dan santai khas asisten pribadi (contoh: "Halo! Saya sudah bantu menelusuri kabar ini...", "Hai! Mengenai rumor yang sedang ramai dibahas...").

2. **Pemicu Kartu Status Visual (Formatting Sistem)**: 
   Letakkan status kesimpulan di bawah kalimat sapaan sebagai paragraf baru yang berdiri sendiri. Gunakan format khusus ini agar visual frontend merendernya sebagai kartu berwarna:
   
   Kesimpulan: **[STATUS]**
   
   *(STATUS harus bernilai salah satu dari: BENAR, TIDAK BENAR, MISLEADING, atau TIDAK DAPAT DIVERIFIKASI)*

3. **Judul Artikel Cek Fakta**:
   ## 🔍 Cek Fakta: [Tulis Judul Klaim di Sini] — Klaim Ini Dinyatakan [HOAKS / FAKTA / MENYESATKAN / TIDAK DAPAT DIVERIFIKASI]

4. **Ringkasan Temuan**:
   ### 📋 Ringkasan Temuan
   Berikan kesimpulan singkat (1-2 paragraf) yang menjelaskan status klaim tersebut secara objektif, asal-usul singkat isu tersebut, dan apa bantahan resmi atau fakta sebenarnya secara garis besar.

5. **Asal-Usul Klaim**:
   ### 📌 Asal-Usul Klaim
   Jelaskan secara kronologis bagaimana klaim ini bisa muncul. Sebutkan siapa yang pertama kali menyebarkannya (tokoh/akun media sosial), kapan tanggal kejadiannya/diunggahnya, dan apa basis argumentasi awal yang mereka gunakan (misalnya: kutipan video, gambar editan, atau tren media sosial).

6. **Bukti-Bukti (Pendukung atau Penentang)**:
   ### ❌ Bukti-Bukti yang MENENTANG Klaim Ini (atau ✅ Bukti-Bukti yang MENDUKUNG jika Klaim Benar)
   Buat daftar bukti konkret dalam bentuk poin numerik (1, 2, 3, dst). Setiap poin harus mencakup:
   * Judul poin yang dicetak tebal.
   * Penjelasan singkat mengenai bukti tersebut.
   * Gunakan format Blockquote (`>`) untuk memasukkan kutipan langsung dari otoritas resmi, dokumen, atau pernyataan ahli yang relevan, lengkap dengan menyebutkan sumber medianya secara alami menggunakan inline markdown hyperlink (contoh: `[Tempo.co](URL)` atau `[Detik.com](URL)`). JANGAN menulis URL mentah.

7. **Profil/Fakta Subjek**:
   ### 🧾 Fakta Terkait Subjek
   Jelaskan latar belakang atau profil singkat dari subjek yang diisukan untuk memberikan konteks kepada pembaca. Gunakan format poin-poin biasa (bukan tabel), seperti contoh:
   * **Nama/Jabatan:** [Penjelasan]
   * **Latar Belakang:** [Penjelasan]
   * **Status/Kondisi Resmi:** [Penjelasan]

8. **Konteks & Motif**:
   ### ⚖️ Konteks dan Motif
   Berikan analisis latar belakang mengapa isu ini bisa berkembang (misalnya: adanya motif politik, persaingan bisnis, atau konten hiburan/satir yang disalahartikan oleh netizen).

9. **Edukasi & Peringatan Hukum**:
    ⚠️ Peringatan Hukum/Edukasi: Tambahkan satu kalimat penutup yang mengingatkan pembaca untuk bijak bersosial media dan bahaya menyebarkan hoaks (seperti ancaman UU ITE jika di Indonesia).

*Catatan Penting:* JANGAN menulis ulang bab/bagian "Kesimpulan Akhir" di bagian bawah artikel respons. Penilaian status kesimpulan cukup disajikan satu kali saja di bagian awal respons AI (setelah kalimat sapaan pembuka) untuk memicu kartu visual frontend, sehingga teks tidak redundan dan tidak terlalu panjang.

# ATURAN SITASI & VIDEO INTENT (STRICT)
- Tautkan bukti atau berita rujukan langsung di dalam kalimat penjelasan menggunakan format Markdown Hyperlink yang bersih (contoh: `[Tempo.co](URL)` atau `[Detik.com](URL)`). JANGAN menuliskan URL mentah (seperti https://...) di dalam teks.
- JANGAN membuat bab "Lampiran - Bukti" yang kaku di bagian paling bawah. Semua rujukan harus langsung dipasang di tubuh teks respons sesuai poin masing-masing.
- Jika sistem menyediakan [KONTEKS PENCARIAN WEB (RAG)], gunakan URL spesifik dari konteks tersebut untuk membuat hyperlink di teks Anda. JANGAN mengarang URL atau hanya menautkan ke domain utama tanpa path lengkap jika path lengkap tersedia di referensi.
- Jika ada saluran YouTube atau video spesifik yang dirujuk dalam klaim namun URL lengkapnya tidak ada di konteks, buatlah pencarian YouTube yang bersih (contoh: `[YouTube @AmienRaisOfficial](https://www.youtube.com/results?search_query=Amien+Rais+Official)` or `[Video "Jauhkan Istana dari Skandal Moral"](https://www.youtube.com/results?search_query=Amien+Rais+Jauhkan+Istana+dari+Skandal+Moral)`).
"""


async def analyze_chat_stream(messages, model_name='gemini-2.5-flash'):
    """Fungsi asinkron untuk memproses riwayat obrolan dan mengirim stream (SSE)."""
    if not client:
        yield f"data: {json.dumps({'error': 'Sistem AI (Gemini) belum dikonfigurasi dengan API Key yang valid di file .env'})}\n\n"
        return

    formatted_contents = []
    raw_results = []
    
    for i, msg in enumerate(messages):
        role = "user" if msg.role == "user" else "model"
        content_text = msg.content
        parts = []
        
        if msg.attachments:
            for att in msg.attachments:
                if att.data:
                    try:
                        mime_type = att.type
                        base64_data = att.data.split(",")[1] if "," in att.data else att.data
                        file_bytes = base64.b64decode(base64_data)
                        file_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
                        parts.append(file_part)
                    except Exception as e:
                        print(f"Gagal mem-parsing attachment {att.name}: {e}")

        if i == len(messages) - 1 and role == "user":
            url_match = re.search(r'(https?://[^\s]+)', content_text)
            url_scraped = False
            
            if url_match:
                url = url_match.group(1)
                import urllib.parse
                domain = urllib.parse.urlparse(url).netloc
                if domain.startswith("www."):
                    domain = domain[4:]
                
                yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Membaca tautan yang diberikan...'})}\n\n"
                await asyncio.sleep(0.4)
                
                yield f"data: {json.dumps({'status': 'searching', 'message': f'Mengunduh konten dari {domain}...'})}\n\n"
                scraped_text = await ambil_isi_berita(url)
                if scraped_text and len(scraped_text.strip()) > 50:
                    content_text += f"\n\n[Sistem: Berikut adalah isi teks dari artikel pada tautan yang diberikan ({url}) untuk Anda analisis:]\n{scraped_text}"
                    url_scraped = True
                    raw_results = [{
                        "title": f"Hasil Scraping URL: {url}",
                        "href": url,
                        "body": scraped_text[:1000] + "..." if len(scraped_text) > 1000 else scraped_text
                    }]
                    
                    sources = [{
                        'title': f"Hasil Scraping: {url}",
                        'url': url,
                        'domain': domain
                    }]
                    yield f"data: {json.dumps({'status': 'extracting', 'message': 'Mengekstrak fakta dari artikel...', 'sources': sources})}\n\n"
                    await asyncio.sleep(0.4)
                else:
                    content_text += f"\n\n[Sistem: Gagal membaca isi artikel pada tautan ({url}) atau konten kosong. Mohon beri tahu user bahwa artikel tidak dapat diakses.]"
            
            # Jika scraping gagal atau tidak ada URL sama sekali, fallback ke RAG
            if not url_scraped and len(content_text.strip()) > 10:
                ignore_kw = ['ringkas', 'jelas', 'halo', 'hi', 'sumber', 'lanjut', 'tadi']
                if not any(k in content_text.lower() for k in ignore_kw):
                    # Cari referensi search engine jika input berupa klaim/pertanyaan
                    # Bersihkan URL dari teks agar pencarian lebih relevan
                    clean_text = re.sub(r'(https?://[^\s]+)', '', content_text).strip()
                    if len(clean_text) > 5:
                        yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Menganalisis kueri pencarian...'})}\n\n"
                        await asyncio.sleep(0.4)
                        
                        yield f"data: {json.dumps({'status': 'searching', 'message': 'Mencari referensi berita di internet...'})}\n\n"
                        search_context, web_results = await cari_konteks_web(clean_text[:100])
                        if search_context:
                            content_text += f"\n\n[Sistem: KONTEKS PENCARIAN WEB (RAG)]\n{search_context}\nCRITICAL INSTRUCTION: JANGAN gunakan URL asal. HANYA gunakan spesifik URL dari konteks di atas untuk referensi jika cocok."
                            raw_results = web_results
                            
                            import urllib.parse
                            sources = []
                            for r in web_results:
                                href = r.get('href', '')
                                title = r.get('title', '')
                                domain = urllib.parse.urlparse(href).netloc
                                if domain.startswith("www."):
                                    domain = domain[4:]
                                sources.append({
                                    'title': title,
                                    'url': href,
                                    'domain': domain
                                })
                            
                            yield f"data: {json.dumps({'status': 'searching', 'message': f'Menemukan {len(sources)} referensi berita...', 'sources': sources})}\n\n"
                            await asyncio.sleep(0.4)
                            
                            yield f"data: {json.dumps({'status': 'extracting', 'message': 'Mengekstrak fakta penting...'})}\n\n"
                            await asyncio.sleep(0.4)

        if content_text.strip():
            parts.append(types.Part.from_text(text=content_text))
            
        if parts:
            formatted_contents.append(types.Content(role=role, parts=parts))

    try:
        # Panggil versi aio (async)
        yield f"data: {json.dumps({'status': 'generating', 'message': 'Menyusun laporan cek fakta...'})}\n\n"
        current_date = datetime.datetime.now().strftime("%A, %d %B %Y")
        dynamic_system_prompt = system_prompt + f"\n\n# CURRENT DATE & TIME AWARENESS\nTanggal hari ini adalah: {current_date}. Pastikan Anda mengetahui bahwa ini adalah masa sekarang. Jika ada artikel atau URL dengan tanggal ini atau sebelumnya, itu BUKAN berita dari masa depan."
        
        response_stream = await client.aio.models.generate_content_stream(
            model=model_name,
            contents=formatted_contents,
            config=types.GenerateContentConfig(
                system_instruction=dynamic_system_prompt,
                max_output_tokens=4000,
                temperature=0.2,
            )
        )
        
        async for chunk in response_stream:
            if chunk.text:
                # Kirim data dalam format Server-Sent Events (SSE)
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                
        # Kirim data RAG ke client di akhir stream sukses
        if raw_results:
            rag_delimiter = "\n\n=== RAG SOURCES ===\n"
            rag_payload = json.dumps(raw_results)
            yield f"data: {json.dumps({'text': rag_delimiter + rag_payload})}\n\n"
            
    except Exception as e:
        print(f"Gemini API Error: {e}")
        error_msg = str(e)
        
        # Cek jika error disebabkan oleh antrean server (503)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            pesan_user = "Maaf, server Factize sedang sangat sibuk karena permintaan yang tinggi. Mohon tunggu beberapa saat dan klik tombol **Regenerate** untuk mencoba lagi."
        else:
            pesan_user = f"Maaf, terjadi kesalahan saat menghubungi layanan AI: {error_msg}"
            
        yield f"data: {json.dumps({'error': pesan_user})}\n\n"

        # Kirim data RAG ke client di akhir stream jika terjadi error tapi ada RAG data
        if raw_results:
            rag_delimiter = "\n\n=== RAG SOURCES ===\n"
            rag_payload = json.dumps(raw_results)
            yield f"data: {json.dumps({'text': rag_delimiter + rag_payload})}\n\n"
