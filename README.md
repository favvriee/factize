# si-FAKTA

**si-FAKTA** adalah aplikasi berbasis web yang berfungsi sebagai asisten *chatbot* cerdas (AI) untuk mendeteksi dan mencari kebenaran mengenai suatu berita atau klaim. Aplikasi ini mampu menganalisis berbagai jenis masukan seperti teks, dokumen (PDF, TXT), hingga gambar (*screenshot* berita) untuk menentukan apakah informasi tersebut kemungkinan fakta atau hoaks.

## 🚀 Teknologi yang Digunakan

Aplikasi ini dibangun menggunakan arsitektur modern yang dipisah menjadi dua bagian utama:

- **Frontend (Antarmuka):** Dibangun menggunakan **React.js** (dengan *build tool* Vite). Antarmuka didesain secara khusus dengan *Vanilla CSS* untuk memberikan tampilan yang *premium*, modern (Dark Mode), dinamis, serta mendukung fitur *drag-and-drop* untuk pengunggahan media.
- **Backend (Otak Sistem):** Menggunakan **Python** dengan *framework* **FastAPI**. Bertugas sebagai jembatan yang cepat dan tangguh untuk menerima *request* dari Frontend, memproses media (ekstraksi PDF via PyMuPDF dan OCR gambar via Tesseract), lalu mengirimkannya ke **Google Gemini AI** untuk dianalisis.

## 📋 Prasyarat

Sebelum menjalankan aplikasi, pastikan komputer Anda telah terinstal perangkat lunak berikut:
1. **Node.js** (untuk menjalankan frontend React/Vite)
2. **Python 3.10+** (untuk backend FastAPI)
3. **Tesseract-OCR** (Wajib untuk fitur ekstraksi teks dari gambar). 
   - *Pengguna Linux/Ubuntu dapat menginstalnya dengan perintah:* `sudo apt-get install tesseract-ocr tesseract-ocr-ind`
4. **API Key Gemini** dari [Google AI Studio](https://aistudio.google.com/app/apikey)

## 🛠️ Cara Instalasi & Menjalankan Aplikasi

Anda perlu menjalankan *server* Backend dan Frontend secara bersamaan di terminal yang berbeda.

### 1. Setup & Jalankan Backend (FastAPI)

Buka terminal pertama, arahkan ke direktori proyek, lalu jalankan:

```bash
cd backend

# Buat virtual environment (hanya untuk pertama kali)
python3 -m venv venv

# Aktifkan virtual environment
source venv/bin/activate  # Untuk Linux/macOS
# venv\Scripts\activate   # Untuk Windows

# Instal semua dependensi pustaka
pip install -r requirements.txt
```

**Konfigurasi API Key:**
Salin template konfigurasi `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Setelah itu, buka file `.env` tersebut dan masukkan API Key Gemini Anda:
```env
GEMINI_API_KEY=KODE_API_GEMINI_ANDA_DI_SINI
```

**Jalankan Server:**
```bash
uvicorn app.main:app --reload
```
*Backend akan berjalan di `http://localhost:8000`.*

---

### 2. Setup & Jalankan Frontend (React)

Buka jendela terminal kedua, arahkan ke direktori proyek, lalu jalankan:

```bash
cd frontend

# Instal semua paket dependensi NPM
npm install

# Jalankan server frontend
npm run dev
```
*Frontend akan berjalan di `http://localhost:5173`.*

## 💡 Cara Penggunaan
1. Buka browser Anda dan akses `http://localhost:5173`.
2. Ketik klaim berita, teks, atau salin tautan di kolom percakapan dan tekan **Kirim**.
3. Jika Anda memiliki tangkapan layar berita (gambar) atau dokumen PDF, Anda bisa langsung menarik (*drag*) file tersebut ke area kotak unggah (*upload*).
4. si-FAKTA akan mengekstrak informasi yang ada, dan menggunakan AI untuk memberikan analisis objektivitas dari data tersebut.
