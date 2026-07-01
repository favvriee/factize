import React, { useState, useRef, useEffect } from 'react';
import ExifReader from 'exifreader';
import { UploadCloud, ShieldCheck, AlertTriangle, ScanLine, Image as ImageIcon, Info, Cpu, FileSearch, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../services/translations';

export function DetectorAI({ onOpenInfo, language }) {
  const t = translations[language || "id"];
  
  // App Modes: 'visual' (pixelforensics) or 'text' (ocr forensics)
  const [mode, setMode] = useState('visual');
  // OCR Target Mode: 'screenshot' (chat/news) or 'document' (official policies)
  const [ocrMode, setOcrMode] = useState('screenshot');
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
  
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Reset states on mode switch
  useEffect(() => {
    setImageSrc(null);
    setFileType(null);
    setResult(null);
    setShowRawText(false);
  }, [mode]);

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
      if (file) {
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
    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      alert(language === "en" ? "File size is too large (Max 5MB)." : "Ukuran file terlalu besar (Maksimal 5MB).");
      return;
    }

    // Tipe validasi berdasarkan mode
    if (mode === 'visual') {
      if (!file.type.startsWith('image/')) {
        alert(language === "en" ? "Visual Forensics mode only supports image files." : "Mode Forensik Piksel hanya mendukung file gambar.");
        return;
      }
      processVisualImage(file);
    } else {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert(language === "en" ? "Text Forensics mode supports Image (PNG, JPG) or PDF files." : "Mode Forensik Teks mendukung file Gambar (PNG, JPG) atau PDF.");
        return;
      }
      processOcrFile(file);
    }
  };

  const processVisualImage = async (file) => {
    setIsLoading(true);
    setResult(null);
    setFileType(file.type);
    setImageSrc(URL.createObjectURL(file));

    try {
      // 1. Baca metadata menggunakan ExifReader
      const tags = await ExifReader.load(file);
      const isMetadataAI = analyzeMetadataSync(tags);
      
      if (isMetadataAI) {
        setTimeout(() => setIsLoading(false), 1500);
        return;
      }
      
      // 2. Jika Metadata Bersih, kirim ke Backend ELA Fallback
      await runElaFallback(file);

    } catch (error) {
      console.error("Gagal membaca metadata:", error);
      await runElaFallback(file);
    }
  };

  const runElaFallback = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const hostname = window.location.hostname;
      const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.");
      const apiBase = import.meta.env.VITE_API_URL || (isLocal ? `http://${hostname}:8000` : `/_/backend`);
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
        throw new Error(language === "en" ? "Failed to connect to ELA scanner" : "Gagal terhubung ke pemindai ELA");
      }
      
      const data = await response.json();
      setTimeout(() => {
        setResult(data);
        setIsLoading(false);
      }, 1000);
      
    } catch (err) {
      console.error(err);
      setTimeout(() => {
        setResult({
          isAI: false,
          confidence: "50%",
          method: "Error Level Analysis (ELA)",
          reason: language === "en" ? "Failed to connect to Error Level Analysis scanner (Backend). Make sure the server is running." : "Gagal terhubung ke pemindai Error Level Analysis (Backend). Pastikan server menyala."
        });
        setIsLoading(false);
      }, 1000);
    }
  };

  const processOcrFile = async (file) => {
    setIsLoading(true);
    setResult(null);
    setFileType(file.type);
    
    // Preview gambar jika ia adalah file gambar, jika PDF set null
    if (file.type.startsWith('image/')) {
      setImageSrc(URL.createObjectURL(file));
    } else {
      setImageSrc(null);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", ocrMode);

      const hostname = window.location.hostname;
      const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.");
      const apiBase = import.meta.env.VITE_API_URL || (isLocal ? `http://${hostname}:8000` : `/_/backend`);
      const headers = {};
      
      const customGeminiKey = localStorage.getItem("sifakta_gemini_key");
      if (customGeminiKey) {
        headers["X-Gemini-API-Key"] = customGeminiKey;
      }

      const response = await fetch(`${apiBase}/api/verify-ocr`, {
        method: "POST",
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(language === "en" ? "OCR Server connection failed" : "Gagal terhubung ke server OCR");
      }

      const data = await response.json();
      setTimeout(() => {
        setResult(data);
        setIsLoading(false);
      }, 1200);

    } catch (err) {
      console.error(err);
      setTimeout(() => {
        setResult({
          success: false,
          isManipulated: false,
          confidence: "0%",
          analysis: language === "en" ? "Failed to analyze document text. Please make sure backend server is active and Gemini API Key is configured." : "Gagal menganalisis teks dokumen. Pastikan server backend aktif dan Kunci API Gemini telah dikonfigurasi."
        });
        setIsLoading(false);
      }, 1200);
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
        reason: language === "en" ? `System detected AI generator digital signature (${foundKeyword.toUpperCase()}) embedded within C2PA / EXIF metadata structure.` : `Sistem mendeteksi tanda tangan digital generator AI (${foundKeyword.toUpperCase()}) yang tertanam pada struktur metadata C2PA / EXIF.`
      });
      return true;
    }
    return false;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFDF6] min-w-0 overflow-y-auto sidebar-scroll relative select-none">
      
      {/* Header (Desktop Only) */}
      <div className="hidden lg:flex border-b border-[#21302A]/8 bg-[#FFFDF6] px-4 lg:px-8 py-4 flex items-center justify-between z-10 shadow-sm sticky top-0">
        <div className="flex flex-col gap-1">
          <h1 className="font-f1 text-[#21302A] text-[22px] leading-none">Truth Scan</h1>
          <p className="text-[#5C6E60] text-sm">{language === "en" ? "Visual & Document Forensics Engine" : "Mesin Forensik Visual & Dokumen"}</p>
        </div>
        <button 
          onClick={onOpenInfo}
          className="p-2 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-xl transition-colors flex items-center gap-2 font-medium text-sm border border-transparent hover:border-[#21302A]/10"
        >
          <Info className="w-5 h-5" /> {language === "en" ? "Detector Info" : "Info Detektor"}
        </button>
      </div>

      {/* Main Content */}
      <div className="p-4 lg:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6 pb-12">
        
        {/* Toggle Mode */}
        <div className="bg-[#E5EBE8]/60 p-1 rounded-2xl border border-[#21302A]/8 flex w-full max-w-md mx-auto backdrop-blur-sm shadow-2xs">
          <button
            onClick={() => setMode('visual')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              mode === 'visual'
                ? "bg-[#2A3A34] text-white shadow-sm"
                : "text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5"
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            {t.detectorModeVisual}
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              mode === 'text'
                ? "bg-[#2A3A34] text-white shadow-sm"
                : "text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5"
            }`}
          >
            <FileSearch className="w-3.5 h-3.5" />
            {t.detectorModeText}
          </button>
        </div>

        {/* OCR Config Row */}
        {mode === 'text' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2 max-w-md mx-auto w-full"
          >
            <div className="flex flex-col gap-0.5 ml-1">
              <span className="text-xs font-bold text-[#21302A]">{t.ocrFileSelectTitle}</span>
              <span className="text-[10px] text-[#5C6E60]">{t.ocrFileSelectDesc}</span>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setOcrMode("screenshot")}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-98 ${
                  ocrMode === "screenshot"
                    ? "bg-[#F7F4E9] border-[#2A3A34] text-[#2A3A34] shadow-3xs"
                    : "bg-white border-[#21302A]/10 text-[#5C6E60] hover:bg-gray-50"
                }`}
              >
                {t.ocrTypeScreenshot}
              </button>
              <button
                onClick={() => setOcrMode("document")}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-98 ${
                  ocrMode === "document"
                    ? "bg-[#F7F4E9] border-[#2A3A34] text-[#2A3A34] shadow-3xs"
                    : "bg-white border-[#21302A]/10 text-[#5C6E60] hover:bg-gray-50"
                }`}
              >
                {t.ocrTypeDocument}
              </button>
            </div>
          </motion.div>
        )}

        {/* Dropzone */}
        <div 
          className={`relative border-2 border-dashed rounded-[32px] p-8 lg:p-12 text-center cursor-pointer transition-all duration-300 overflow-hidden flex flex-col items-center justify-center min-h-[300px]
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
            accept={mode === 'visual' ? "image/*" : "image/*,application/pdf"} 
            onChange={handleFileSelect} 
          />
          
          {!imageSrc && fileType !== 'application/pdf' ? (
            <div className="flex flex-col items-center gap-4 pointer-events-none">
              <div className="w-20 h-20 bg-[#E5EBE8] rounded-full flex items-center justify-center mb-2 shadow-inner">
                {mode === 'visual' ? <ScanLine className="w-10 h-10 text-[#21302A]" /> : <FileSearch className="w-10 h-10 text-[#21302A]" />}
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#21302A]">
                {mode === 'visual' ? (language === "en" ? "Drag & Drop Image" : "Tarik & Lepas Gambar") : (language === "en" ? "Drag & Drop Image / PDF" : "Tarik & Lepas Gambar / PDF")}
              </h2>
              <p className="text-xs md:text-sm text-[#5C6E60]">
                {language === "en" ? <>Or <strong>Click</strong> to select from your device</> : <>Atau <strong>Klik</strong> untuk memilih dari perangkat Anda</>}
              </p>
              <span className="text-[10px] bg-[#21302A]/5 text-[#5C6E60] px-3 py-1 rounded-full font-medium">
                {mode === 'visual' ? (language === "en" ? "Supports image files (PNG, JPG)" : "Mendukung berkas gambar (PNG, JPG)") : t.pdfSupportedText}
              </span>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col sm:flex-row items-center justify-center gap-6 min-h-[200px]">
              
              {/* Gambar Asli / PDF Icon */}
              <div className="relative flex flex-col items-center">
                <span className="text-[10px] font-bold mb-2 bg-[#21302A]/10 px-3 py-1 rounded-full text-[#21302A]">
                  {fileType === 'application/pdf' ? 'PDF Document' : (language === "en" ? "Input Image" : "Gambar Input")}
                </span>
                
                {fileType === 'application/pdf' ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-white border border-[#21302A]/10 rounded-2xl shadow-xs w-36 h-36">
                    <FileSearch className="w-14 h-14 text-red-500 mb-2" />
                    <span className="text-[10px] font-bold text-[#5C6E60] truncate max-w-full">PDF File</span>
                  </div>
                ) : (
                  <img src={imageSrc} alt="Preview" className="max-w-full max-h-[250px] object-contain rounded-xl shadow-md z-10" />
                )}
              </div>

              {/* Gambar Hasil ELA (Hanya mode visual) */}
              {mode === 'visual' && result && result.ela_image_base64 && !isLoading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative flex flex-col items-center"
                >
                  <span className="text-[10px] font-bold mb-2 bg-[#00ffcc]/20 px-3 py-1 rounded-full text-[#00a884]">{language === "en" ? "ELA Noise Map (Visualizer)" : "Peta Noise ELA (Visualizer)"}</span>
                  <div className="relative rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,255,204,0.15)] ring-1 ring-[#00ffcc]/30">
                    <img src={result.ela_image_base64} alt="ELA Map" className="max-w-full max-h-[250px] object-contain rounded-xl" />
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
                    <p className="text-white font-medium tracking-wide text-xs">
                      {mode === 'visual' ? (language === "en" ? "Scanning Digital Footprint..." : "Memindai Jejak Digital...") : t.ocrExtracting}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Result Area for Visual Mode */}
        {mode === 'visual' && result && !isLoading && (
          result.success === false ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl border border-orange-200 bg-orange-50/50 flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm w-full"
            >
              <div className="p-4 rounded-full flex-shrink-0 bg-orange-100 text-orange-700">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="flex-1 flex flex-col gap-1.5 font-sans">
                <h3 className="text-xl font-bold text-orange-800">
                  {language === "en" ? 'Analysis Failed' : 'Analisis Gambar Gagal'}
                </h3>
                <p className="text-[15px] mt-1.5 leading-relaxed text-orange-900/80">
                  <strong>{language === "en" ? "Reason:" : "Penyebab:"}</strong> {result.reason}
                </p>
              </div>
            </motion.div>
          ) : (
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
                  {result.isAI 
                    ? (language === "en" ? 'Indicated AI (Digital Manipulation)' : 'Terindikasi AI (Rekayasa Digital)') 
                    : (language === "en" ? 'Indicated Genuine / Safe' : 'Terindikasi Asli / Aman')}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/5 text-black/70">
                    {language === "en" ? "Confidence Level" : "Tingkat Keyakinan"}: {result.confidence}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                    {language === "en" ? "Method" : "Metode"}: {result.method || "Visual Analysis"}
                  </span>
                </div>
                <p className={`text-[15px] mt-1.5 leading-relaxed ${result.isAI ? 'text-red-900/80' : 'text-green-900/80'}`}>
                  <strong>{language === "en" ? "Analysis:" : "Analisis:"}</strong> {result.reason}
                </p>
              </div>
            </motion.div>
          )
        )}

        {/* Result Area for OCR Mode */}
        {mode === 'text' && result && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5 w-full"
          >
            {/* Verdict Card */}
            <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm
              ${result.isManipulated ? 'bg-red-50 border-red-200' : 'bg-[#E8F5E9]/50 border-green-200'}`}>
              <div className={`p-4 rounded-full flex-shrink-0 ${result.isManipulated ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                {result.isManipulated ? <AlertTriangle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <h3 className={`text-xl font-bold font-serif ${result.isManipulated ? 'text-red-700' : 'text-green-800'}`}>
                  {result.isManipulated 
                    ? t.ocrVerdictManipulated
                    : t.ocrVerdictGenuine}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/5 text-black/70">
                    {language === "en" ? "Fact Match Score" : "Persentase Kecocokan"}: {result.confidence}
                  </span>
                  {result.sourceMatch && result.sourceMatch !== "None" && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                      {t.ocrVerdictSource}: {result.sourceMatch}
                    </span>
                  )}
                </div>
                <p className={`text-[15px] mt-1.5 leading-relaxed ${result.isManipulated ? 'text-red-900/80' : 'text-green-900/80'}`}>
                  <strong>{t.ocrVerdictAnalysis}:</strong> {result.analysis}
                </p>
              </div>
            </div>

            {/* Extracted Raw Text Card */}
            <div className="bg-white border border-[#21302A]/10 rounded-2xl overflow-hidden shadow-xs">
              <button 
                onClick={() => setShowRawText(!showRawText)}
                className="w-full px-5 py-4 flex items-center justify-between font-bold text-xs md:text-sm text-[#21302A] hover:bg-gray-50 border-b border-[#21302A]/5"
              >
                <span>{t.ocrExtractedText}</span>
                <span className="text-[10px] text-[#5C6E60] font-medium">{showRawText ? (language === "en" ? 'Hide' : 'Sembunyikan') : (language === "en" ? 'Show' : 'Tampilkan')}</span>
              </button>
              {showRawText && (
                <div className="p-5 bg-gray-50/50 max-h-[250px] overflow-y-auto font-mono text-[11px] md:text-xs text-[#5C6E60] whitespace-pre-wrap leading-relaxed">
                  {result.text}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
