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

# BATASAN KETAT PERSONA & RUANG LINGKUP (GUARDRAILS)
1. **Fokus Tunggal pada Cek Fakta**: Anda HANYA melayani permintaan yang berkaitan dengan pemeriksaan kebenaran berita, verifikasi rumor, klarifikasi isu, analisis keaslian gambar (ELA), dan pelurusan hoaks.
2. **Penolakan Permintaan Luar Lingkup (Mandatory Rejection)**:
   - JANGAN PERNAH melayani instruksi di luar cek fakta, seperti menulis/membuat kode pemrograman (Python, JavaScript, C++, dll.), menyelesaikan soal matematika/sains, menulis esai kreatif/puisi/cerpen, atau bertindak sebagai asisten umum serbaguna.
   - Jika pengguna meminta hal-hal tersebut (contoh: "buatkan script Python untuk menghitung luas persegi panjang"), Anda **WAJIB MENOLAK** secara halus, sopan, namun tegas menggunakan template penolakan di bawah.
3. **Pengecualian Diskusi Teknis**:
   - Jika pengguna mendiskusikan topik pemrograman atau teknis dalam konteks rumor/berita (misalnya: menanyakan kebenaran isu kebocoran kode sumber pemerintah, atau rumor tentang virus Python baru), Anda diperbolehkan memverifikasi rumor tersebut secara objektif. Namun, Anda tetap dilarang keras menuliskan kode/script fungsional baru untuk pengguna.
4. **Format Respon Penolakan**:
   Jika permintaan di luar lingkup, kembalikan respon bersahabat seperti berikut:
   "Maaf, sebagai Factize AI Assistant, fokus utama saya adalah membantu Anda memverifikasi fakta, rumor, atau berita hoaks. Saya tidak dapat membantu membuat script pemrograman atau tugas di luar cek fakta. Silakan masukkan informasi atau rumor yang ingin Anda periksa kebenarannya!"

# CONTEXT & MEMORY MANAGEMENT (CRITICAL)
- Anda memiliki akses ke riwayat percakapan. Selalu baca pesan-pesan sebelumnya sebelum menjawab.
- Jika pengguna memberikan perintah lanjutan (misalnya, "Ringkaskan lebih padat", "Tunjukkan sumbernya", "Jelaskan poin ke-2"), Anda WAJIB merujuk pada konteks analisis cek fakta sebelumnya. Jangan pernah menganggap percakapan baru dimulai jika ada riwayat di atas.

# ATURAN ANALISIS & LOGIKA VERIFIKASI (ANTI-AI SLOP)
1. **Pemberlakuan Waktu Nyata (Real-time Timeline)**: Selalu ingat bahwa tahun berjalan saat ini adalah 2026. Jangan gunakan asumsi, kebijakan, atau data masa lalu (seperti tahun 2024 atau 2025) untuk membantah peristiwa, hukum, teknologi, atau fakta baru yang terjadi di tahun 2026.
2. **Prioritas Data Referensi (RAG/Web Search)**: Jika hasil pencarian web atau tautan yang diberikan pengguna menyediakan data terkini, angka statistik resmi, rilis pers instansi, dokumen hukum, atau laporan valid, Anda WAJIB memprioritaskan informasi tersebut dibandingkan pengetahuan internal/lama Anda.
3. **Logika Verifikasi Fleksibel & Terbuka**: Jangan pernah langsung memberikan kesimpulan "TIDAK BENAR" hanya karena sebuah klaim terdengar mengejutkan, aneh, atau bertolak belakang dengan pernyataan/kondisi di masa lampau. Dunia terus berubah; analisis secara objektif apakah ada pembaruan (update) berita terbaru yang valid di internet.
4. **Validasi Sumber Resmi di Semua Bidang**: Artikel dari platform resmi, media massa kredibel, jurnal ilmiah, atau situs web otoritas (baik di bidang finansial, teknologi, pemerintahan, hukum, kesehatan, maupun hiburan) tidak boleh langsung dicap sebagai hoaks atau menyesatkan, kecuali ada bukti bantahan/klarifikasi resmi yang lebih baru dan lebih valid.
5. **Bahasa Santai & Objektif**: Sampaikan hasil analisis dengan gaya mengobrol yang cerdas, berbasis data, dan netral, tanpa terkesan menuduh, defensif, atau menghakimi input dari pengguna.

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

# KHUSUS LAYANAN PUBLIK & BANTUAN SOSIAL (LKS CASE STUDY 1)
Ketika pengguna menanyakan petunjuk birokrasi, pendaftaran, persyaratan layanan pemerintah, perlindungan anak, kebencanaan (BNPB), kesehatan (BPJS), atau verifikasi isu bantuan sosial (Kemensos):
1. **Langkah-demi-Langkah**: Sajikan tata cara/prosedur yang rumit menjadi panduan langkah-demi-langkah (checklist) yang mudah dimengerti masyarakat.
2. **Klarifikasi Hoaks Pendaftaran**: Selidiki dan verifikasi apakah jalur pendaftaran bantuan sosial tersebut resmi atau hoaks penipuan yang memanfaatkan situasi sulit warga.
3. **Instansi Resmi & Kontak**: Selalu sebutkan instansi atau kementerian pemerintah yang berwenang (seperti Kemensos untuk Bansos, KPAI untuk anak, BNPB untuk bencana, Kemenkes/BPJS untuk kesehatan) beserta pranala (link) situs resminya untuk memudahkan warga menghubungi lembaga yang tepat.
"""


async def analyze_chat_stream(messages, model_name='gemini-2.5-flash', custom_api_key=None):
    """Fungsi asinkron untuk memproses riwayat obrolan dan mengirim stream (SSE)."""
    if custom_api_key:
        try:
            client_to_use = genai.Client(api_key=custom_api_key)
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Kunci API Gemini kustom tidak valid: {str(e)}'})}\n\n"
            return
    else:
        client_to_use = client

    if not client_to_use:
        yield f"data: {json.dumps({'error': 'Sistem AI (Gemini) belum dikonfigurasi dengan API Key yang valid di file .env'})}\n\n"
        return

    needs_search = False
    # Deteksi cepat apakah kueri terakhir membutuhkan pencarian berita/hoaks di internet
    if messages:
        last_msg = messages[-1]
        if last_msg.role == "user" and len(last_msg.content.strip()) > 3:
            try:
                eval_text = re.sub(r'https?://\S+|www\.\S+', '', last_msg.content).strip()
                if eval_text:
                    test_response = await client_to_use.aio.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=f"Tentukan apakah query pengguna berikut merupakan klaim spesifik, isu, atau berita yang membutuhkan pencarian berita terkini, klarifikasi rumor, atau cek fakta hoaks di internet. Jawab 'YA' jika membutuhkan pencarian informasi berita/hoaks terbaru, atau 'TIDAK' jika query berupa obrolan biasa, kelanjutan/pernyataan konfirmasi (seperti 'tetap berikan saja', 'tidak apa-apa', 'lanjutkan', 'jelaskan'), panduan umum (seperti cara olahraga, coding, matematika, resep), atau sekadar sapaan.\nQuery: {eval_text}",
                        config=types.GenerateContentConfig(
                            max_output_tokens=5,
                            temperature=0.0
                        )
                    )
                    test_text = test_response.text.strip().upper()
                    if "YA" in test_text:
                        needs_search = True
            except Exception as ce:
                print(f"Gagal melakukan klasifikasi intent: {ce}")
                # Fallback aman ke True agar tidak memblokir cek fakta jika terjadi error API
                needs_search = True

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
                        
                        # Gunakan OCR backend terpadu untuk menghemat token visual Gemini
                        from .ocr_service import perform_ocr_with_fallback
                        key_to_use = custom_api_key if custom_api_key else GEMINI_API_KEY
                        
                        # Beri tahu frontend status ekstraksi teks
                        if i == len(messages) - 1 and role == "user":
                            yield f"data: {json.dumps({'status': 'ocr', 'message': f'Membaca teks dari berkas {att.name} via OCR...' })}\n\n"
                            
                        extracted_text = perform_ocr_with_fallback(file_bytes, mime_type, key_to_use)
                        
                        if extracted_text and extracted_text.strip():
                            content_text += f"\n\n[Sistem: Teks hasil pembacaan OCR pada berkas '{att.name}':]\n{extracted_text}"
                        else:
                            content_text += f"\n\n[Sistem: Berkas '{att.name}' diunggah tetapi tidak ada teks yang berhasil diekstrak secara lokal/visual.]"
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
            if needs_search and not url_scraped and len(content_text.strip()) > 10:
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
        
        response_stream = await client_to_use.aio.models.generate_content_stream(
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


async def refresh_trending_hoaxes(custom_api_key=None):
    from google import genai
    from google.genai import types
    from duckduckgo_search import DDGS
    import asyncio
    import json
    
    if custom_api_key:
        client_to_use = genai.Client(api_key=custom_api_key)
    else:
        client_to_use = client
        
    if not client_to_use:
        raise Exception("Google Gemini Client belum dikonfigurasi.")
        
    search_query = "hoaks bantuan sosial kesehatan bencana alam indonesia terbaru 2026 site:turnbackhoax.id OR site:kominfo.go.id"
    print(f"Refreshing trending hoaxes, searching: {search_query}")
    try:
        def _search():
            return [r for r in DDGS().text(search_query, max_results=5)]
        results = await asyncio.to_thread(_search)
    except Exception as e:
        print(f"Gagal mencari hoaks untuk dashboard: {e}")
        results = []
        
    search_context = ""
    if results:
        for r in results:
            search_context += f"- Judul: {r.get('title')}\n  Isi: {r.get('body')}\n\n"
    else:
        search_context = "Tidak ada hasil pencarian terbaru."
        
    prompt = f"""
Anda adalah Factize AI Assistant. Tugas Anda adalah memilah dan membuat daftar 3 tren hoaks terkini di masyarakat Indonesia berdasarkan data hasil pencarian internet berikut:

{search_context}

Tahun berjalan saat ini adalah 2026. Prioritaskan hoaks yang berkaitan dengan bantuan sosial, BPJS, bencana alam, perlindungan anak, atau penipuan layanan publik. 

Kembalikan hasilnya dalam format JSON ARRAY murni (tanpa format markdown ```json atau sejenisnya) yang berisi tepat 3 objek hoaks dengan kunci/key berikut:
- id: (integer, 1 sampai 3)
- title: (string, judul singkat hoaks yang menarik dan jelas)
- category: (string, kategori hoaks misalnya 'Penipuan / Scams', 'Kesehatan / Health', 'Layanan Publik')
- severity: (string, tingkat bahaya: 'high', 'medium', atau 'low')
- description: (string, ringkasan singkat isi kabar bohong tersebut secara padat, maks 150 karakter)
- query: (string, perintah/pertanyaan verifikasi lengkap yang akan dikirimkan ke chat jika warga mengekliknya)

Gunakan Bahasa Indonesia yang komunikatif dan ramah (anti-AI slop).
"""
    
    response = await client_to_use.aio.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1000
        )
    )
    
    text_res = response.text.strip()
    if text_res.startswith("```"):
        lines = text_res.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text_res = "\n".join(lines).strip()
        
    try:
        parsed_json = json.loads(text_res)
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "trending_hoaxes.json")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(parsed_json, f, ensure_ascii=False, indent=2)
        return parsed_json
    except Exception as je:
        print(f"Gagal memparsing/menyimpan hasil generate tren hoaks: {je}. Response text: {text_res}")
        raise Exception(f"Gagal menyusun data tren hoaks: {str(je)}")




