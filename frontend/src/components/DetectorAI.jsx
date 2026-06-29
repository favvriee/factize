import React, { useState, useRef, useEffect } from 'react';
import ExifReader from 'exifreader';
import { UploadCloud, ShieldCheck, AlertTriangle, ScanLine, Image as ImageIcon, Info, Cpu, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function DetectorAI({ onOpenInfo }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

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
      
      const headers = {};
      const customHfToken = localStorage.getItem("sifakta_hf_token");
      if (customHfToken) {
        headers["X-HF-Token"] = customHfToken;
      }

      const response = await fetch(`${apiBase}/api/scan-image`, {
        method: "POST",
        headers,
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
      
      {/* Header (Desktop Only) */}
      <div className="hidden lg:flex border-b border-[#21302A]/8 bg-[#FFFDF6] px-4 lg:px-8 py-4 flex items-center justify-between z-10 shadow-sm sticky top-0">
        <div className="flex flex-col gap-1">
          <h1 className="font-f1 text-[#21302A] text-[22px] leading-none">Truth Scan</h1>
          <p className="text-[#5C6E60] text-sm">AI Image Detector & Metadata Scanner</p>
        </div>
        <button 
          onClick={onOpenInfo}
          className="p-2 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-xl transition-colors flex items-center gap-2 font-medium text-sm border border-transparent hover:border-[#21302A]/10"
        >
          <Info className="w-5 h-5" /> Info Detektor
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
