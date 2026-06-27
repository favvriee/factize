import React, { useState, useRef, useEffect } from 'react';
import ExifReader from 'exifreader';
import { UploadCloud, ShieldCheck, AlertTriangle, ScanLine, Image as ImageIcon, Info, Cpu, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function DetectorAI() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const scrollRef = useRef(null);

  // Tampilkan modal info otomatis pada kunjungan pertama kali
  useEffect(() => {
    const hasVisited = localStorage.getItem("sifakta_detector_visited");
    if (!hasVisited) {
      setShowInfoModal(true);
      localStorage.setItem("sifakta_detector_visited", "true");
    }
  }, []);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const isBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
      if (isBottom) {
        setHasReadToBottom(true);
      }
    }
  };

  useEffect(() => {
    if (showInfoModal) {
      setTimeout(() => {
        const element = scrollRef.current;
        if (element) {
          if (element.scrollHeight <= element.clientHeight) {
            setHasReadToBottom(true);
          } else {
            setHasReadToBottom(false);
          }
        }
      }, 100);
    }
  }, [showInfoModal]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        validateAndProcess(file);
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      validateAndProcess(file);
    }
  };

  const validateAndProcess = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran gambar terlalu besar (Maksimal 5MB). Harap pilih gambar yang lebih kecil agar pemindaian tetap optimal.");
      return;
    }
    processImage(file);
  };

  const processImage = async (file) => {
    setIsLoading(true);
    setResult(null);
    setImageSrc(URL.createObjectURL(file));

    try {
      // 1. Baca metadata menggunakan ExifReader
      const tags = await ExifReader.load(file);
      const isMetadataAI = analyzeMetadataSync(tags);
      
      if (isMetadataAI) {
        // Jika ketemu manifest C2PA/AI, selesai.
        setTimeout(() => setIsLoading(false), 1500);
        return;
      }
      
      // 2. Jika Metadata Bersih, kirim ke Backend ELA Fallback
      await runElaFallback(file);

    } catch (error) {
      console.error("Gagal membaca metadata:", error);
      // Fallback: Jika exifreader gagal (misal gambar corrupt metadatanya), tetap coba ELA
      await runElaFallback(file);
    }
  };

  const runElaFallback = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBase}/api/scan-image`, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        throw new Error("Gagal terhubung ke pemindai ELA");
      }
      
      const data = await response.json();
      setTimeout(() => {
        setResult(data);
        setIsLoading(false);
      }, 1000); // Ekstra delay untuk efek scanning halus
      
    } catch (err) {
      console.error(err);
      setTimeout(() => {
        setResult({
          isAI: false,
          confidence: "50%",
          reason: "Gagal terhubung ke pemindai Error Level Analysis (Backend). Pastikan server menyala."
        });
        setIsLoading(false);
      }, 1000);
    }
  };

  const analyzeMetadataSync = (tags) => {
    const metadataString = JSON.stringify(tags).toLowerCase();
    
    const aiKeywords = [
      'dall-e', 'openai', 'midjourney', 'stable diffusion', 
      'software: adobe firefly', 'c2pa', 'content credentials', 'synthid', 'com.adobe.firefly'
    ];

    let foundKeyword = null;
    for (const keyword of aiKeywords) {
      if (metadataString.includes(keyword)) {
        foundKeyword = keyword;
        break;
      }
    }

    if (foundKeyword) {
      setResult({
        isAI: true,
        confidence: "95%",
        method: "Metadata (C2PA)",
        reason: `Sistem mendeteksi tanda tangan digital generator AI (${foundKeyword.toUpperCase()}) yang tertanam pada struktur metadata C2PA / EXIF.`
      });
      return true;
    }
    return false;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFDF6] min-w-0 overflow-y-auto sidebar-scroll relative">
      
      {/* ── Info Modal (Disclosure) ── */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#17221E]/40 backdrop-blur-md px-4"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-[#FFFDF6] border border-[#21302A]/10 shadow-[0_20px_50px_rgba(33,48,42,0.15)] rounded-3xl p-6 md:p-8 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-6 border-b border-[#21302A]/10 pb-4">
                <div className="p-3 bg-[#E5EBE8] text-[#21302A] rounded-2xl shadow-sm">
                  <ScanLine className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-2xl text-[#21302A]">Panduan Deteksi Truth Scan</h3>
                  <p className="text-xs text-[#5C6E60]">Sistem Verifikasi Citra Hybrid & AI Forensik</p>
                </div>
              </div>

              {/* Scrollable Content */}
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="text-[#5C6E60] text-[14px] leading-relaxed space-y-5 overflow-y-auto sidebar-scroll pr-2 flex-1"
              >
                <p>
                  <strong>Truth Scan</strong> adalah fitur pintar untuk mengidentifikasi apakah suatu gambar dihasilkan oleh kecerdasan buatan (AI) atau merupakan foto jepretan kamera asli.
                </p>

                {/* Grid Metrik */}
                <div className="space-y-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <Cpu className="w-4.5 h-4.5 text-indigo-600" /> Detektor AI Google SigLIP
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Menggunakan arsitektur jaringan saraf visual tingkat lanjut (SigLIP) yang dilatih pada 120.000 citra untuk mengenali tanda tangan piksel tersembunyi yang ditinggalkan oleh generator AI seperti Midjourney, DALL-E, atau Stable Diffusion.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <ScanLine className="w-4.5 h-4.5 text-emerald-600" /> Error Level Analysis (ELA)
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Menghitung ulang tingkat kompresi piksel secara lokal. ELA menyoroti perbedaan tingkat error piksel, mempermudah Anda mendeteksi bagian gambar yang telah dimanipulasi atau disunting.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <FileSearch className="w-4.5 h-4.5 text-amber-600" /> Validasi Metadata EXIF & C2PA
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Mengekstrak berkas metadata kriptografis untuk mendeteksi manifes C2PA (Kredensial Konten) resmi atau riwayat asal-usul berkas.
                    </p>
                  </div>
                </div>

                {/* PEMBERITAHUAN PENTING (Screenshot Warning) */}
                <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex gap-3 text-amber-950 shadow-inner">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-[13px] text-amber-850 mb-1">Pemberitahuan Penting: Tangkapan Layar (Screenshot)</h4>
                    <p className="text-[11px] leading-relaxed text-amber-900/85">
                      Sistem ini dirancang khusus untuk membedakan <strong>foto asli dari kamera</strong> dengan <strong>foto sintetis buatan AI</strong>. 
                      <br /><br />
                      Gambar berupa <strong>screenshot chat, UI aplikasi, logo, atau teks murni</strong> tidak memiliki derau (noise) lensa kamera fisik. Karakteristik piksel komputer yang sangat tajam dan presisi tersebut <strong>hampir selalu diidentifikasi oleh AI sebagai Rekayasa Digital/Sintetis</strong>. Harap hanya mengunggah foto jepretan kamera untuk hasil yang akurat.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-[#21302A]/10">
                <button 
                  disabled={!hasReadToBottom}
                  onClick={() => setShowInfoModal(false)}
                  className={`w-full py-3 rounded-2xl font-semibold transition-all duration-200 shadow-md ${
                    hasReadToBottom 
                      ? 'bg-[#21302A] text-[#FFFDF6] hover:bg-[#2F443C] active:scale-[0.98] cursor-pointer shadow-[#21302A]/10' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {hasReadToBottom ? 'Saya Mengerti & Mulai Scan' : 'Harap Scroll Ke Bawah Untuk Menyetujui'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="border-b border-[#21302A]/8 bg-[#FFFDF6] px-4 lg:px-8 py-4 flex items-center justify-between z-10 shadow-sm sticky top-0">
        <div className="flex flex-col gap-1">
          <h1 className="font-f1 text-[#21302A] text-[22px] leading-none">Truth Scan</h1>
          <p className="text-[#5C6E60] text-sm">AI Image Detector & Metadata Scanner</p>
        </div>
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-2 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-xl transition-colors hidden md:flex items-center gap-2 font-medium text-sm border border-transparent hover:border-[#21302A]/10"
        >
          <Info className="w-5 h-5" /> Info Detektor
        </button>
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-2 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-xl transition-colors md:hidden"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="p-4 lg:p-8 max-w-4xl mx-auto w-full flex flex-col gap-8 pb-12">
        
        {/* Dropzone */}
        <div 
          className={`relative border-2 border-dashed rounded-[32px] p-8 lg:p-12 text-center cursor-pointer transition-all duration-300 overflow-hidden flex flex-col items-center justify-center min-h-[350px]
            ${isDragOver ? 'border-[#4caf50] bg-[#4caf50]/5' : 'border-[#21302A]/20 bg-white hover:border-[#21302A]/30 hover:bg-[#F7F4E9]/50'}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileSelect} 
          />
          
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-4 pointer-events-none">
              <div className="w-20 h-20 bg-[#E5EBE8] rounded-full flex items-center justify-center mb-2 shadow-inner">
                <ScanLine className="w-10 h-10 text-[#21302A]" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#21302A]">Tarik & Lepas Gambar</h2>
              <p className="text-[#5C6E60]">Atau <strong>Klik</strong> untuk memilih dari perangkat Anda</p>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col sm:flex-row items-center justify-center gap-6 min-h-[250px]">
              
              {/* Gambar Asli */}
              <div className="relative flex flex-col items-center">
                <span className="text-xs font-semibold mb-2 bg-[#21302A]/10 px-3 py-1 rounded-full text-[#21302A]">Gambar Input</span>
                <img src={imageSrc} alt="Preview" className="max-w-full max-h-[300px] sm:max-h-[350px] object-contain rounded-xl shadow-md z-10" />
              </div>

              {/* Gambar Hasil ELA (Jika ada) */}
              {result && result.ela_image_base64 && !isLoading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative flex flex-col items-center"
                >
                  <span className="text-xs font-semibold mb-2 bg-[#00ffcc]/20 px-3 py-1 rounded-full text-[#00a884]">Peta Noise ELA (Visualizer)</span>
                  <div className="relative rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,255,204,0.15)] ring-1 ring-[#00ffcc]/30">
                    <img src={result.ela_image_base64} alt="ELA Map" className="max-w-full max-h-[300px] sm:max-h-[350px] object-contain rounded-xl" />
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#21302A]/80 backdrop-blur-sm rounded-xl overflow-hidden"
                  >
                    {/* Scanning Bar Animation */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#00ffcc] shadow-[0_0_15px_#00ffcc] animate-[scan_1.5s_linear_infinite]" />
                    <ScanLine className="w-12 h-12 text-[#00ffcc] mb-3 animate-pulse" />
                    <p className="text-white font-medium tracking-wide">Memindai Jejak Digital...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Result Area */}
        {result && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm
              ${result.isAI ? 'bg-red-50 border-red-200' : 'bg-[#E8F5E9]/50 border-green-200'}`}
          >
            <div className={`p-4 rounded-full flex-shrink-0 ${result.isAI ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
              {result.isAI ? <AlertTriangle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <h3 className={`text-xl font-bold font-serif ${result.isAI ? 'text-red-700' : 'text-green-800'}`}>
                {result.isAI ? 'Terindikasi AI (Rekayasa Digital)' : 'Terindikasi Asli / Aman'}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/5 text-black/70">
                  Tingkat Keyakinan: {result.confidence}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  Metode: {result.method}
                </span>
              </div>
              <p className={`text-[15px] mt-1.5 leading-relaxed ${result.isAI ? 'text-red-900/80' : 'text-green-900/80'}`}>
                <strong>Analisis:</strong> {result.reason}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
