import React, { useState, useRef, useEffect } from "react";
import { 
  Send, Paperclip, Link as LinkIcon, Image as ImageIcon, 
  TrendingUp, AlignLeft, ExternalLink, ShieldCheck, 
  Copy, RefreshCw, Square, ChevronDown, Plus, ArrowUp, Globe, Zap, Brain, UploadCloud, Info, ThumbsUp, ThumbsDown, Cpu,
  AlertTriangle, Pencil, Menu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";

function AIAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm mt-0.5 overflow-hidden">
      <img src="/logo1.png" alt="Factize" className="w-full h-full object-cover" />
    </div>
  );
}

function ShimmerLoader({ message }) {
  return (
    <div className="flex items-center gap-3 py-2 min-w-[200px] px-2">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 bg-[#21302A]/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2.5 h-2.5 bg-[#21302A]/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2.5 h-2.5 bg-[#21302A]/40 rounded-full animate-bounce"></span>
      </div>
      <span className="text-[15px] text-[#21302A]/70 font-medium ml-2 animate-pulse">
        {message || "Factize memproses..."}
      </span>
    </div>
  );
}

function RAGSourcesAccordion({ sources }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#21302A]/8 w-full text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-[#F7F4E9] hover:bg-[#E8E4D8] border border-[#21302A]/10 rounded-xl text-sm font-semibold text-[#21302A] transition-all active:scale-[0.98] cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#5C6E60]" />
          Lihat Sumber Referensi ({sources.length})
        </span>
        <ChevronDown
          className={`w-4 h-4 opacity-60 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 pl-1 pr-1 pb-2">
              {sources.map((src, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-white border border-[#21302A]/10 rounded-xl shadow-xs text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-bold text-[#21302A] leading-tight">
                      {src.title || "Referensi Tanpa Judul"}
                    </h4>
                    {src.href && (
                      <a
                        href={src.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 font-semibold flex-shrink-0"
                      >
                        Kunjungi <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {src.body && (
                    <p className="text-[#5C6E60] leading-relaxed line-clamp-3 hover:line-clamp-none transition-all duration-300">
                      {src.body}
                    </p>
                  )}
                  {src.href && (
                    <span className="text-[10px] text-[#21302A]/40 block truncate">
                      {src.href}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PILL =
  "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-[#21302A]/12 bg-[#F7F4E9] text-[#21302A] hover:bg-[#E8E4D8] transition-all duration-150 cursor-pointer select-none active:scale-[0.97]";

const ACTION_BTN = 
  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A] transition-colors active:scale-95 leading-none";

const ALTERNATIVE_PHRASES = [
  "Apa yang ingin Anda cek hari ini?",
  "Temukan kebenaran berita & rumor.",
  "Verifikasi info dengan Factize AI.",
  "Selidiki kebenaran informasi di sini.",
  "Saring hoaks secara instan & akurat."
];

export function ChatArea({ isSidebarOpen, onToggleSidebar, messages, onSendMessage, onEditSendMessage, isLoading, onStopGeneration, onRegenerate, selectedModel, onModelChange }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [feedbackState, setFeedbackState] = useState({});
  const dragCounter = useRef(0);
  const scrollRef = useRef(null);

  // Tampilkan modal info otomatis pada kunjungan pertama kali ke Chat
  useEffect(() => {
    const hasVisited = localStorage.getItem("sifakta_chat_visited");
    if (!hasVisited) {
      setShowInfoModal(true);
      localStorage.setItem("sifakta_chat_visited", "true");
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

  const realMessages = messages ? messages.filter(m => m.id !== 'welcome' && m.id !== 'welcome-new') : [];
  const hasConversation = realMessages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = (text) => {
    const content = text ?? inputText;
    if (content.trim() || attachments.length > 0) {
      onSendMessage(content, attachments.length > 0 ? attachments : undefined);
      setInputText("");
      setAttachments([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files) setAttachments(Array.from(files));
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  // URL Detection Regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const detectedUrls = inputText.match(urlRegex) || [];

  const handleFeedback = (msgId, type) => {
    setFeedbackState(prev => ({
      ...prev,
      [msgId]: prev[msgId] === type ? null : type // Toggle feedback
    }));
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter(file => file.type.startsWith('image/') || file.type === 'application/pdf');
      
      if (validFiles.length > 0) {
        setAttachments(prev => [...prev, ...validFiles]);
      }
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-[#FFFDF6] min-w-0 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      
      {/* ── Drag & Drop Overlay ── */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#FFFDF6]/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center justify-center w-[calc(100%-3rem)] h-[calc(100%-3rem)] border-[3px] border-dashed border-[#21302A]/20 rounded-[32px] bg-white/40 shadow-2xl pointer-events-none transition-all duration-300">
              <div className="w-20 h-20 bg-[#E5EBE8] rounded-full flex items-center justify-center mb-6 animate-bounce shadow-inner">
                <UploadCloud className="w-10 h-10 text-[#21302A]" />
              </div>
              <h2 className="text-3xl font-extrabold font-serif text-[#21302A] mb-3 tracking-tight drop-shadow-sm">Lepaskan File di Sini</h2>
              <p className="text-[#5C6E60] font-medium bg-[#F7F4E9] px-4 py-1.5 rounded-full text-sm shadow-sm border border-[#21302A]/5">Mendukung Gambar (.jpg, .png) & PDF</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <Brain className="w-7 h-7 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-2xl text-[#21302A]">Panduan Factize Chat</h3>
                  <p className="text-xs text-[#5C6E60]">Asisten Verifikasi Informasi & Anti-Hoaks</p>
                </div>
              </div>

              {/* Scrollable Content */}
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="text-[#5C6E60] text-[14px] leading-relaxed space-y-5 overflow-y-auto sidebar-scroll pr-2 flex-1"
              >
                <p>
                  <strong>Factize Chat</strong> dirancang khusus sebagai ruang verifikasi klaim dan pencarian fakta. Asisten ini bekerja secara taktis dan analitis untuk membongkar hoaks di internet.
                </p>

                {/* Grid Fitur & Model */}
                <div className="space-y-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <Zap className="w-4.5 h-4.5 text-amber-500" fill="currentColor"/> Gemini Flash Mode
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Menggunakan model **Gemini 2.5 Flash**. Mode ini sangat cepat dan ideal untuk menganalisis teks singkat, mengekstrak data dari dokumen/gambar (OCR), serta melakukan verifikasi berita viral sehari-hari secara kilat.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <Brain className="w-4.5 h-4.5 text-indigo-500"/> Gemini Deep Fact-Check
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Menggunakan model **Gemini 2.5 Pro**. Mode ini melakukan peninjauan mendalam dengan penalaran logika tinggi. Sangat direkomendasikan untuk klaim konspirasi yang rumit, pencarian jurnal ilmiah, atau dokumen PDF tebal.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <Globe className="w-4.5 h-4.5 text-blue-500"/> Pencarian Web Real-time
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Dilengkapi dengan pencarian web terintegrasi secara dinamis. Sistem Factize otomatis menyuntikkan parameter waktu terkini pada pencarian internet untuk memastikan data yang dianalisis adalah data terbaru (Juni 2026).
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                    <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                      <Cpu className="w-4.5 h-4.5 text-emerald-600"/> Penanganan Typo Finansial & Politik
                    </h4>
                    <p className="text-xs text-[#5C6E60] leading-normal">
                      Sistem kami secara otomatis mendeteksi kesalahan ketik umum di Indonesia (seperti *mcii*, *ihsg*, *prabowo ke francis*) untuk dicocokkan dengan kueri pencarian resmi yang benar sebelum dianalisis oleh AI.
                    </p>
                  </div>
                </div>

                {/* INFO PENTING: Konteks Percakapan (Memory) */}
                <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex gap-3 text-amber-950 shadow-inner">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-[13px] text-amber-850 mb-1">Manajemen Memori Percakapan</h4>
                    <p className="text-[11px] leading-relaxed text-amber-900/85">
                      Asisten ini mengingat seluruh riwayat pesan Anda dalam sesi yang sama. Jika Anda mengajukan pertanyaan lanjutan seperti:
                      <br />
                      <em>"Ringkaskan lebih padat"</em>, <em>"Jelaskan poin ke-2"</em>, atau <em>"Apa sumbernya?"</em>,
                      <br /><br />
                      AI akan meninjau analisis sebelumnya dan memberikan kelanjutan yang relevan tanpa mengulang dari awal.
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
                  {hasReadToBottom ? 'Saya Mengerti & Mulai Chat' : 'Harap Scroll Ke Bawah Untuk Menyetujui'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="border-b border-[#21302A]/8 bg-[#FFFDF6] px-4 py-3 pl-14 lg:pl-6 flex items-center gap-3 z-10 shadow-sm relative h-[60px]">
        
        {/* Mobile Header Title */}
        <div className="flex-1 lg:hidden text-center pr-2">
          <h1 className="font-f1 text-[#21302A] text-[22px] leading-none">
            Factize
          </h1>
        </div>
        <div className="lg:hidden flex items-center">
          <button onClick={() => setShowInfoModal(true)} className="p-1.5 text-[#21302A]/60 hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-md transition-colors">
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Header Left (Model Selector) */}
        <div className="hidden lg:block relative">
          <button 
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1.5 bg-transparent rounded-md px-2 py-1.5 text-sm font-semibold text-[#21302A] hover:bg-[#21302A]/5 transition-colors"
          >
            {selectedModel === 'gemini-2.5-flash' ? <><Zap className="w-4 h-4 text-amber-500" fill="currentColor" /> Flash Mode</> : <><Brain className="w-4 h-4 text-indigo-500" /> Deep Fact-Check</>}
            <ChevronDown className="w-4 h-4 opacity-60 ml-1" />
          </button>
          
          {showModelDropdown && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-[#21302A]/10 rounded-xl shadow-lg py-1.5 z-50">
              <button 
                onClick={() => { onModelChange('gemini-2.5-flash'); setShowModelDropdown(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#F7F4E9] flex items-center gap-2 ${selectedModel === 'gemini-2.5-flash' ? 'font-bold bg-[#F7F4E9]' : ''}`}
              >
                <Zap className="w-4 h-4 text-amber-500" fill="currentColor" /> Flash Mode <span className="ml-auto text-[10px] text-[#5C6E60]">Fast</span>
              </button>
              <button 
                onClick={() => { onModelChange('gemini-2.5-pro'); setShowModelDropdown(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#F7F4E9] flex items-center gap-2 ${selectedModel === 'gemini-2.5-pro' ? 'font-bold bg-[#F7F4E9]' : ''}`}
              >
                <Brain className="w-4 h-4 text-indigo-500" /> Deep Fact-Check <span className="ml-auto text-[10px] text-[#5C6E60]">Pro</span>
              </button>
            </div>
          )}
        </div>

        {/* Desktop Header Right (Info Modal) */}
        <div className="hidden lg:flex flex-1 justify-end items-center gap-2">
          <button 
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-1.5 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 px-2.5 py-1.5 rounded-md transition-colors text-sm font-medium"
          >
            <Info className="w-4 h-4" /> Info
          </button>
        </div>
      </div>



      {/* ── Messages ── */}
      {hasConversation && (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 sidebar-scroll scroll-smooth z-10" onClick={() => setShowModelDropdown(false)}>
        <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-4">
          {realMessages.map((message, index) => {
            const isUser = message.sender === "user";
            const isLastMessage = index === realMessages.length - 1;
            const isEmptyAi = !isUser && message.text === "" && message.isStreaming;

            // Split RAG sources if present in AI response
            const textToRender = message.text || "";
            const parts = textToRender.split("=== RAG SOURCES ===");
            const mainText = parts[0] || "";
            let ragSources = [];
            if (parts[1]) {
               try {
                ragSources = JSON.parse(parts[1].trim());
              } catch (e) {
                // Ignore parse errors during active streaming
              }
            }

            return (
              <div
                key={message.id}
                className={`flex animate-fadeIn group relative w-full ${
                  isUser
                    ? "justify-end"
                    : "justify-start items-start"
                }`}
              >

                <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[90%] md:max-w-[80%] w-full`}>
                  <div
                    className={`${
                      isUser
                        ? "bg-[#2A3A34] text-[#FFFDF6] rounded-[20px] rounded-tr-[4px] px-5 pt-5 pb-4 shadow-sm"
                        : "bg-transparent text-[#21302A] px-1 pt-2 pb-2"
                    } w-full`}
                  >
                    
                    {/* Render Image first in user bubble if any, with padding below */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className={`space-y-2 w-full ${message.text ? "mb-4" : ""}`}>
                        {message.attachments.map((att, idx) => {
                          const isImage = att.type?.startsWith('image/');
                          return (
                            <div key={idx} className="relative group overflow-hidden rounded-[14px] max-w-full md:max-w-[280px]">
                              {isImage && att.data ? (
                                <img src={att.data} alt={att.name} className="w-full object-cover rounded-[14px]" />
                              ) : (
                                <div className="bg-[#FFFDF6] border border-[#21302A]/10 px-4 py-3 rounded-[12px] flex items-center gap-3">
                                  <Paperclip className="w-5 h-5 opacity-70 text-[#21302A]" />
                                  <span className="text-sm font-medium truncate opacity-90 text-[#21302A]">{att.name}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isEmptyAi ? (
                      <div className="w-full flex flex-col gap-3">
                        {message.streamingSources && message.streamingSources.length > 0 && (
                          <div className="w-full flex flex-col gap-1.5 font-sans select-none border-b border-[#21302A]/6 pb-3">
                            <span className="text-[10px] uppercase tracking-wider text-[#21302A]/40 font-bold">
                              Sumber penelusuran web:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {message.streamingSources.map((src, srcIdx) => (
                                <motion.a
                                  key={srcIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  transition={{ duration: 0.3, delay: srcIdx * 0.05 }}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFFDF6] hover:bg-[#F7F4E9] border border-[#21302A]/8 hover:border-[#21302A]/15 rounded-full text-xs font-medium text-[#21302A] transition-all shadow-2xs cursor-pointer active:scale-95 animate-fadeIn"
                                >
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                                    alt={src.domain}
                                    onError={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'; }}
                                    className="w-3.5 h-3.5 rounded-full"
                                  />
                                  <span className="truncate max-w-[120px]">{src.domain}</span>
                                </motion.a>
                              ))}
                            </div>
                          </div>
                        )}
                        <ShimmerLoader message={message.streamingMessage} />
                      </div>
                    ) : (
                      <div className="text-[15px] leading-relaxed break-words markdown-content w-full">
                        {isUser && editingMessageId === message.id ? (
                          <div className="w-full flex flex-col gap-2.5 mt-1">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-[#1F2C27] text-white border border-white/20 rounded-xl p-3 outline-none resize-none text-[15px] font-sans"
                              rows={3}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-[#FFFDF6] transition-colors cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                onClick={() => {
                                  if (editText.trim() && onEditSendMessage) {
                                    onEditSendMessage(message.id, editText);
                                    setEditingMessageId(null);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                              >
                                Simpan & Kirim
                              </button>
                            </div>
                          </div>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p: ({node, children, ...props}) => {
                                const text = React.Children.toArray(children).map(child => {
                                  if (typeof child === 'string') return child;
                                  if (child && child.props && child.props.children) {
                                    if (typeof child.props.children === 'string') {
                                      return child.props.children;
                                    }
                                    if (Array.isArray(child.props.children)) {
                                      return child.props.children.join('');
                                    }
                                  }
                                  return '';
                                }).join('').trim();

                                if (text.startsWith("Kesimpulan:")) {
                                  const statusMatch = text.match(/Kesimpulan:\s*\**([A-Z\s]+)\**/i);
                                  if (statusMatch) {
                                    const status = statusMatch[1].trim().toUpperCase();
                                    
                                    let config = {
                                      bg: "from-emerald-500/12 to-emerald-600/5 text-emerald-800 border-emerald-500/20 shadow-emerald-500/5",
                                      dot: "bg-emerald-500 shadow-emerald-500/50",
                                      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
                                      label: "Terverifikasi Faktual / Benar"
                                    };
                                    
                                    if (status.includes("BENAR") || status.includes("FAKTA") || status.includes("ASLI") || status.includes("AMAN")) {
                                      if (status.includes("TIDAK")) {
                                        config = {
                                          bg: "from-rose-500/12 to-rose-600/5 text-rose-800 border-rose-500/20 shadow-rose-500/5",
                                          dot: "bg-rose-500 shadow-rose-500/50 animate-pulse",
                                          icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
                                          label: "Terindikasi Hoaks / Salah"
                                        };
                                      }
                                    } else if (status.includes("SALAH") || status.includes("HOAKS") || status.includes("MISLEADING") || status.includes("PALSU")) {
                                      config = {
                                        bg: "from-rose-500/12 to-rose-600/5 text-rose-800 border-rose-500/20 shadow-rose-500/5",
                                        dot: "bg-rose-500 shadow-rose-500/50 animate-pulse",
                                        icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
                                        label: "Terindikasi Hoaks / Salah"
                                      };
                                    } else {
                                      config = {
                                        bg: "from-amber-500/12 to-amber-600/5 text-amber-800 border-amber-500/20 shadow-amber-500/5",
                                        dot: "bg-amber-500 shadow-amber-500/50",
                                        icon: <Info className="w-5 h-5 text-amber-600" />,
                                        label: "Informasi Tidak Dapat Diverifikasi"
                                      };
                                    }

                                    const cleanText = text.replace(/Kesimpulan:\s*\**[A-Z\s]+\**\.?\s*/i, "");

                                    return (
                                      <div className="w-full flex flex-col">
                                        <motion.div 
                                          whileHover={{ scale: 1.01, y: -1 }}
                                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 rounded-2xl border bg-gradient-to-r ${config.bg} font-sans my-5 shadow-sm relative overflow-hidden select-none`}
                                        >
                                          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-current opacity-[0.03] blur-xl pointer-events-none" />
                                          <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-white/60 dark:bg-black/10 shadow-xs border border-white/40">
                                              {config.icon}
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-[10px] uppercase tracking-widest text-[#5C6E60]/80 font-bold leading-none mb-1">
                                                Hasil Analisis Factize
                                              </span>
                                              <span className="text-[15px] font-extrabold tracking-tight uppercase leading-tight">
                                                KESIMPULAN: {status}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 self-start sm:self-auto bg-white/50 border border-white/20 dark:bg-black/5 px-3 py-1.5 rounded-full text-xs font-semibold">
                                            <span className="relative flex h-2 w-2">
                                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
                                              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
                                            </span>
                                            <span className="opacity-90">{config.label}</span>
                                          </div>
                                        </motion.div>
                                        {cleanText && <p className="mb-3 last:mb-0 whitespace-pre-wrap text-[15px] leading-relaxed break-words text-[#21302A]">{cleanText}</p>}
                                      </div>
                                    );
                                  }
                                }

                                return <p className="mb-3 last:mb-0 whitespace-pre-wrap" {...props}>{children}</p>;
                              },
                              strong: ({node, ...props}) => <strong className="font-bold text-inherit" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3" {...props} />,
                              li: ({node, ...props}) => <li className="mb-1" {...props} />,
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-3 mt-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-3 mt-2" {...props} />,
                              h3: ({node, children, ...props}) => {
                                const text = React.Children.toArray(children).map(child => typeof child === 'string' ? child : '').join('');
                                if (text.includes("KESIMPULAN:")) {
                                  const parts = text.split("KESIMPULAN:");
                                  const status = parts[1].trim().toUpperCase();
                                  
                                  let config = {
                                    bg: "from-emerald-500/12 to-emerald-600/5 text-emerald-800 border-emerald-500/20 shadow-emerald-500/5",
                                    dot: "bg-emerald-500 shadow-emerald-500/50",
                                    icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
                                    label: "Terverifikasi Faktual / Benar"
                                  };
                                  
                                  if (status.includes("BENAR") || status.includes("FAKTA") || status.includes("ASLI") || status.includes("AMAN")) {
                                    // Emerald Green theme
                                  } else if (status.includes("SALAH") || status.includes("HOAKS") || status.includes("MISLEADING") || status.includes("PALSU")) {
                                    config = {
                                      bg: "from-rose-500/12 to-rose-600/5 text-rose-800 border-rose-500/20 shadow-rose-500/5",
                                      dot: "bg-rose-500 shadow-rose-500/50 animate-pulse",
                                      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
                                      label: "Terindikasi Hoaks / Salah"
                                    };
                                  } else {
                                    config = {
                                      bg: "from-amber-500/12 to-amber-600/5 text-amber-800 border-amber-500/20 shadow-amber-500/5",
                                      dot: "bg-amber-500 shadow-amber-500/50",
                                      icon: <Info className="w-5 h-5 text-amber-600" />,
                                      label: "Informasi Tidak Dapat Diverifikasi"
                                    };
                                  }
                                  
                                  return (
                                    <motion.div 
                                      whileHover={{ scale: 1.01, y: -1 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 rounded-2xl border bg-gradient-to-r ${config.bg} font-sans my-5 shadow-sm relative overflow-hidden select-none`}
                                    >
                                      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-current opacity-[0.03] blur-xl pointer-events-none" />
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-white/60 dark:bg-black/10 shadow-xs border border-white/40">
                                          {config.icon}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[10px] uppercase tracking-widest text-[#5C6E60]/80 font-bold leading-none mb-1">
                                            Hasil Analisis Factize
                                          </span>
                                          <span className="text-[15px] font-extrabold tracking-tight uppercase leading-tight">
                                            KESIMPULAN: {status}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 self-start sm:self-auto bg-white/50 border border-white/20 dark:bg-black/5 px-3 py-1.5 rounded-full text-xs font-semibold">
                                        <span className="relative flex h-2 w-2">
                                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
                                          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
                                        </span>
                                        <span className="opacity-90">{config.label}</span>
                                      </div>
                                    </motion.div>
                                  );
                                }
                                return <h3 className="text-md font-bold mb-2 mt-2" {...props}>{children}</h3>;
                              },
                              a: ({node, ...props}) => (
                                <a 
                                  className="text-blue-400 hover:text-blue-300 underline decoration-blue-500/50 hover:decoration-blue-400 underline-offset-2 transition-colors font-medium break-all" 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  {...props} 
                                />
                              ),
                              blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-[#21302A]/20 pl-4 py-1 italic my-3 bg-[#21302A]/5 rounded-r-md" {...props} />
                              )
                            }}
                          >
                            {mainText}
                          </ReactMarkdown>
                        )}

                        {/* RAG sources accordion dropdown */}
                        {!isUser && ragSources && ragSources.length > 0 && (
                          <RAGSourcesAccordion sources={ragSources} />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Bagian Bawah Bubble (Timestamp & Action Buttons) */}
                  <div className={`flex items-center gap-3 mt-1.5 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-[11px] font-medium text-[#21302A]/40 mt-0.5">
                      {formatTime(message.timestamp)}
                    </span>
                    
                    {isUser && (
                      <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity duration-200 ml-1">
                        <button
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditText(message.text);
                          }}
                          className="p-1 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-md transition-colors active:scale-90 cursor-pointer"
                          title="Edit Perintah"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(message.text)}
                          className="p-1 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 rounded-md transition-colors active:scale-90 cursor-pointer"
                          title="Salin Perintah"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {/* Action Buttons AI (Regenerate, Copy, Feedback) */}
                    {!isUser && message.id !== "welcome" && !message.isStreaming && (
                      <div className="flex items-center gap-1 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 ml-1 ease-out focus-within:opacity-100">
                        
                        {/* Feedback Thumbs */}
                        <div className="flex items-center bg-[#21302A]/5 rounded-md p-0.5 mr-1">
                          <button 
                            onClick={() => handleFeedback(message.id, 'up')}
                            className={`p-1 rounded-md transition-colors ${feedbackState[message.id] === 'up' ? 'text-green-600 bg-green-100' : 'text-[#5C6E60] hover:bg-[#21302A]/10 hover:text-[#21302A]'}`}
                            title="Tanggapan Baik / Relevan"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-[1px] h-3 bg-[#21302A]/10 mx-0.5"></div>
                          <button 
                            onClick={() => handleFeedback(message.id, 'down')}
                            className={`p-1 rounded-md transition-colors ${feedbackState[message.id] === 'down' ? 'text-red-600 bg-red-100' : 'text-[#5C6E60] hover:bg-[#21302A]/10 hover:text-[#21302A]'}`}
                            title="Tanggapan Buruk / Tidak Akurat"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button onClick={() => handleCopy(mainText)} className={ACTION_BTN} title="Salin Teks">
                          <Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Copy</span>
                        </button>
                        
                        {/* Tampilkan regenerate hanya di pesan terakhir yang BUKAN error/loading */}
                        {isLastMessage && !isLoading && onRegenerate && (
                          <button onClick={onRegenerate} className={ACTION_BTN} title="Buat Ulang Jawaban">
                            <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Regenerate</span>
                          </button>
                        )}

                        {/* Jika obrolan panjang, tampilkan opsi follow up di sini saja (kecuali pesan error) */}
                        {isLastMessage && !isLoading && hasConversation && (
                          <>
                            <div className="w-px h-3.5 bg-[#21302A]/20 mx-1"></div>
                            <button onClick={() => handleSend("Ringkaskan lebih padat")} className={ACTION_BTN}>
                              <AlignLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ringkaskan</span>
                            </button>
                            <button onClick={() => handleSend("Tunjukkan sumber resmi yang valid")} className={ACTION_BTN}>
                              <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sumber</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>
      )}

      {/* ── Landing Page Content ── */}
      {!hasConversation && (
        <div className="flex-1 flex flex-col justify-center relative w-full h-full pt-10 pb-20">
          {/* Background Watermark Logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.25] z-0 overflow-hidden">
            <img src="/logo2.png" alt="Factize Watermark" className="w-[400px] h-[400px] md:w-[700px] md:h-[700px] object-contain drop-shadow-sm" />
          </div>

          {/* ── Landing Page Greeting ── */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 md:px-8 w-full z-10 flex flex-col items-center mt-8"
            onClick={() => setShowModelDropdown(false)}
          >
              <h2 
                className="text-[36px] md:text-[52px] font-serif text-[#21302A] mb-4 text-center tracking-tight leading-tight max-w-3xl min-h-[96px] md:min-h-[64px] flex items-center justify-center select-none cursor-default"
                onMouseEnter={() => {
                  setPhraseIndex((prev) => (prev + 1) % ALTERNATIVE_PHRASES.length);
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={phraseIndex}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="block"
                  >
                    {ALTERNATIVE_PHRASES[phraseIndex]}
                  </motion.span>
                </AnimatePresence>
              </h2>
             <p className="text-[#5C6E60] text-[15px] md:text-[17px] text-center max-w-xl mb-12">
                Interaksi dengan Factize untuk mengeksplorasi kebenaran di balik berita, gambar viral, atau rumor terkini.
             </p>
          </motion.div>

          {/* ── Dynamic Quick Action Pills ── */}
          <div className="px-4 md:px-8 pt-5 z-10 w-full" onClick={() => setShowModelDropdown(false)}>
            <div className="max-w-3xl mx-auto flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-wrap justify-center gap-2.5"
              >
                <button onClick={() => setInputText("Cek kebenaran link berita ini: ")} className={PILL}>
                  <LinkIcon className="w-4 h-4 text-[#5C6E60]" />
                  <span className="text-[13px]">Link Berita</span>
                </button>
                <button onClick={() => setInputText("Tolong analisa apakah foto/video ini asli atau hasil rekayasa AI: ")} className={PILL}>
                  <ImageIcon className="w-4 h-4 text-[#5C6E60]" />
                  <span className="text-[13px]">Analisa Visual</span>
                </button>
                <button onClick={() => setInputText("Klarifikasi rumor atau isu terkini: ")} className={PILL}>
                  <TrendingUp className="w-4 h-4 text-[#5C6E60]" />
                  <span className="text-[13px]">Klarifikasi Isu</span>
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stop Generation Button ── */}
      <AnimatePresence>
        {isLoading && onStopGeneration && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-center mb-4 absolute bottom-24 left-0 right-0 z-20 pointer-events-none"
          >
            <button 
              onClick={onStopGeneration}
              className="pointer-events-auto flex items-center gap-2 bg-[#FFFDF6] border border-[#21302A]/20 text-[#21302A] px-4 py-2 rounded-full text-xs font-semibold shadow-md hover:bg-[#F7F4E9] active:scale-95 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Hentikan Pembuatan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Bar ── */}
      <div className={`px-4 md:px-8 z-10 w-full ${hasConversation ? 'pb-6 bg-gradient-to-t from-[#FFFDF6] to-transparent pt-2' : 'pb-8'}`} onClick={() => setShowModelDropdown(false)}>
        <div className="max-w-3xl mx-auto">
          
          <div className="flex flex-col gap-2">
            
            {/* Attachment Previews on Mobile (rendered above input bar) */}
            <div className="lg:hidden">
              {(attachments.length > 0 || detectedUrls.length > 0) && (
                <div className="flex flex-wrap gap-2 px-2 pb-2">
                  {attachments.map((att, idx) => {
                    const isImage = att.type?.startsWith('image/');
                    const objectUrl = isImage ? URL.createObjectURL(att) : null;
                    return (
                      <div key={idx} className="relative group animate-fadeIn">
                        {isImage ? (
                          <div className="w-14 h-14 rounded-[10px] overflow-hidden border border-[#21302A]/10 relative shadow-sm bg-gray-100">
                            <img src={objectUrl} alt={att.name} className="w-full h-full object-cover" />
                            <button
                              onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="absolute top-0.5 right-0.5 text-white bg-black/60 rounded-full w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[#E5E0D0] text-[#21302A] px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 shadow-sm border border-[#21302A]/5">
                            <Paperclip className="w-3 h-3" />
                            <span className="max-w-[100px] truncate font-medium">{att.name}</span>
                            <button
                              onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="hover:text-[#D9534F] text-sm font-bold ml-0.5 leading-none"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {detectedUrls.map((url, idx) => {
                    try {
                      const domain = new URL(url).hostname.replace('www.', '');
                      return (
                        <div key={`url-${idx}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 shadow-sm animate-fadeIn">
                          <LinkIcon className="w-3 h-3" />
                          <span className="font-semibold truncate max-w-[120px]">{domain}</span>
                        </div>
                      );
                    } catch { return null; }
                  })}
                </div>
              )}
            </div>

            {/* Mobile Model Selector (floating above the input capsule) */}
            <div className="lg:hidden flex justify-start gap-1.5 pl-2 mb-1 relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowModelDropdown(!showModelDropdown); }}
                className="flex items-center gap-1 bg-[#F7F4E9] border border-[#21302A]/10 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#21302A] hover:bg-[#E8E4D8] transition-colors shadow-2xs cursor-pointer select-none active:scale-95"
              >
                {selectedModel === 'gemini-2.5-flash' ? <><Zap className="w-3.5 h-3.5 text-amber-500" fill="currentColor" /> Flash Mode</> : <><Brain className="w-3.5 h-3.5 text-indigo-500" /> Deep Check</>}
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
              </button>
              
              {showModelDropdown && (
                <div className="absolute left-2 bottom-full mb-1.5 w-48 bg-white border border-[#21302A]/10 rounded-xl shadow-lg py-1.5 z-50 animate-fadeIn">
                  <button 
                    onClick={() => { onModelChange('gemini-2.5-flash'); setShowModelDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-[#F7F4E9] flex items-center gap-2 ${selectedModel === 'gemini-2.5-flash' ? 'font-bold bg-[#F7F4E9]' : ''}`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" fill="currentColor" /> Flash Mode <span className="ml-auto text-[9px] text-[#5C6E60]">Fast</span>
                  </button>
                  <button 
                    onClick={() => { onModelChange('gemini-2.5-pro'); setShowModelDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-[#F7F4E9] flex items-center gap-2 ${selectedModel === 'gemini-2.5-pro' ? 'font-bold bg-[#F7F4E9]' : ''}`}
                  >
                    <Brain className="w-3.5 h-3.5 text-indigo-500" /> Deep Fact-Check <span className="ml-auto text-[9px] text-[#5C6E60]">Pro</span>
                  </button>
                </div>
              )}
            </div>

            {/* ── Main Input Capsule/Box ── */}
            <div className="bg-white border border-[#21302A]/15 shadow-[0_4px_24px_rgba(33,48,42,0.04)] transition-all focus-within:border-[#21302A]/30 focus-within:shadow-[0_6px_32px_rgba(33,48,42,0.08)] flex md:flex-col flex-row items-center md:items-stretch rounded-full md:rounded-[24px] p-1.5 pl-3 pr-2 md:p-2.5 md:pl-2.5 md:pr-2.5 min-h-[52px] md:min-h-[140px] w-full">
              
              {/* Mobile Left Actions (Plus button inside capsule) */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="md:hidden hover:text-[#21302A] text-[#21302A]/50 transition-colors p-2 rounded-full hover:bg-[#E5EBE8] active:scale-95 flex-shrink-0 cursor-pointer"
                title="Unggah file"
                type="button"
                disabled={isLoading}
              >
                <Plus className="w-5.5 h-5.5" strokeWidth={2.5} />
              </button>

              {/* Previews (Attachments & URLs) - Desktop ONLY (inside box) */}
              <div className="hidden md:block">
                {(attachments.length > 0 || detectedUrls.length > 0) && (
                  <div className="flex flex-wrap gap-3 px-3 pt-2 mb-2">
                    {attachments.map((att, idx) => {
                      const isImage = att.type?.startsWith('image/');
                      const objectUrl = isImage ? URL.createObjectURL(att) : null;
                      return (
                        <div key={idx} className="relative group animate-fadeIn">
                          {isImage ? (
                            <div className="w-16 h-16 rounded-[12px] overflow-hidden border border-[#21302A]/10 relative shadow-sm bg-gray-100">
                              <img src={objectUrl} alt={att.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <button
                                   onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                   className="text-white hover:text-red-400 p-1.5 bg-black/50 rounded-full active:scale-95 transition-transform"
                                 >
                                   ×
                                 </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-[#E5E0D0] text-[#21302A] px-3 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm border border-[#21302A]/5">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="max-w-[120px] truncate font-medium">{att.name}</span>
                              <button
                                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                className="hover:text-[#D9534F] transition-colors font-bold ml-1 text-base leading-none"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {detectedUrls.map((url, idx) => {
                      try {
                        const domain = new URL(url).hostname.replace('www.', '');
                        return (
                          <div key={`url-${idx}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm animate-fadeIn">
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span className="font-semibold truncate max-w-[150px]">{domain}</span>
                          </div>
                        );
                      } catch { return null; }
                    })}
                  </div>
                )}
              </div>

              {/* Text Input Area (Responsive styling) */}
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ketik rumor, atau tempel link..."
                className="flex-1 bg-transparent outline-none text-[#21302A] placeholder:text-[#21302A]/30 text-[15px] resize-none overflow-hidden min-h-[24px] md:min-h-[40px] px-2 py-1 md:px-3 md:pt-3 md:pb-2"
                disabled={isLoading}
                style={{ maxHeight: '200px' }}
              />
              
              {/* Mobile Right Actions (Globe and Send arrow inside capsule) */}
              <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
                <button
                  className="hover:text-[#21302A] text-[#21302A]/50 transition-colors p-2 rounded-full hover:bg-[#E5EBE8] active:scale-95"
                  title="Pencarian Web Aktif"
                  type="button"
                  disabled={isLoading}
                >
                  <Globe className="w-4.5 h-4.5" strokeWidth={2.5} />
                </button>
                
                <button
                  onClick={() => handleSend()}
                  disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
                  className="bg-[#21302A] hover:bg-[#2F4236] disabled:bg-[#F2F2F2] disabled:text-[#A0A0A0] text-[#FFFDF6] p-2 rounded-full transition-all duration-150 disabled:cursor-not-allowed active:scale-95 shadow-sm cursor-pointer"
                  title="Kirim"
                  type="button"
                >
                  <ArrowUp className="w-4.5 h-4.5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Desktop Bottom Actions Row (Hidden on mobile) */}
              <div className="hidden md:flex items-center justify-between mt-auto px-1 pb-1">
                <div className="flex items-center gap-1 text-[#21302A]/50">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:text-[#21302A] transition-colors p-2 rounded-full hover:bg-[#E5EBE8] active:scale-95 cursor-pointer"
                    title="Unggah file"
                    type="button"
                    disabled={isLoading}
                  >
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                  <button
                    className="hover:text-[#21302A] transition-colors p-2 rounded-full hover:bg-[#E5EBE8] active:scale-95"
                    title="Pencarian Web Aktif"
                    type="button"
                    disabled={isLoading}
                  >
                    <Globe className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
                
                <button
                  onClick={() => handleSend()}
                  disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
                  className="bg-[#21302A] hover:bg-[#2F4236] disabled:bg-[#F2F2F2] disabled:text-[#A0A0A0] text-[#FFFDF6] p-2 rounded-full transition-all duration-150 disabled:cursor-not-allowed active:scale-95 shadow-sm cursor-pointer"
                  title="Kirim"
                  type="button"
                >
                  <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>
              
            </div>

          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf"
            disabled={isLoading}
          />
          <p className="text-center text-[10px] text-[#21302A]/40 mt-3 font-semibold select-none tracking-wide">
            Factize adalah AI dan dapat melakukan kesalahan.
          </p>
        </div>
      </div>
    </div>
  );
}
