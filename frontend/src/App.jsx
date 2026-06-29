import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { DetectorAI } from "./components/DetectorAI";
import { MobileTopBar } from "./components/MobileTopBar";
import { SettingsModal } from "./components/SettingsModal";
import { chatWithBot } from "./services/api";
import { Menu, X, Info, Brain, Zap, Globe, Cpu, ScanLine, FileSearch, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import "./styles/index.css";


export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Collapsed by default (Gemini style)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Settings modal state
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'detector'
  const [isLoading, setIsLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const scrollRef = useRef(null);

  // Tampilkan modal info otomatis pada kunjungan pertama kali
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
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const abortControllerRef = useRef(null);
  
  // Storage keys
  const SESSIONS_KEY = "sifakta_sessions";
  const CURRENT_SESSION_KEY = "sifakta_current_session";

  // State
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem(SESSIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    const savedId = localStorage.getItem(CURRENT_SESSION_KEY);
    return savedId || null;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch(e) {
      console.warn("Gagal menyimpan ke localStorage (mungkin kuota penuh)", e);
    }
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }, [currentSessionId]);

  // Derived state: current messages
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  // Fungsi helper convert File ke Base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleSendMessage = async (text, attachments = [], isRegenerate = false) => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    let processedAttachments = [];
    let newMessages = [...messages];
    let sessionIdToUse = currentSessionId;
    let isNewSession = false;

    if (isRegenerate) {
      // Hapus pesan AI terakhir dari newMessages karena state 'messages' 
      // dari closure ini belum ter-update oleh setSessions di handleRegenerate
      let lastAiIndex = -1;
      for (let i = newMessages.length - 1; i >= 0; i--) {
        if (newMessages[i].sender === "ai") {
          lastAiIndex = i;
          break;
        }
      }
      if (lastAiIndex !== -1) {
        newMessages.splice(lastAiIndex, 1);
      }
    } else {
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          try {
            const base64 = await fileToBase64(file);
            processedAttachments.push({ name: file.name, type: file.type, data: base64 });
          } catch(e) {
            console.error("Gagal membaca file", file.name);
          }
        }
      }

      const userMessage = {
        id: Date.now().toString(),
        text: text || "",
        sender: "user",
        timestamp: new Date().toISOString(),
        attachments: processedAttachments,
      };

      newMessages.push(userMessage);
      
      if (!sessionIdToUse) {
        sessionIdToUse = Date.now().toString();
        isNewSession = true;
        setCurrentSessionId(sessionIdToUse);
      }

      setSessions(prev => {
        if (isNewSession) {
          return [{
            id: sessionIdToUse,
            title: text.substring(0, 30) + (text.length > 30 ? "..." : ""),
            timestamp: new Date().toISOString(),
            messages: [userMessage]
          }, ...prev];
        } else {
          return prev.map(s => s.id === sessionIdToUse ? {
            ...s,
            messages: [...s.messages, userMessage],
            timestamp: new Date().toISOString()
          } : s);
        }
      });
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // Buat placeholder kosong untuk pesan AI yang akan di-stream
    const tempAiMsgId = (Date.now() + 1).toString();
    const tempAiMessage = {
      id: tempAiMsgId,
      text: "",
      sender: "ai",
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    setSessions(prev => prev.map(s => s.id === sessionIdToUse ? {
      ...s,
      messages: [...s.messages, tempAiMessage]
    } : s));

    try {
      const payloadMessages = newMessages
        .filter(m => m.id !== "welcome" && m.id !== "welcome-new")
        .map(m => ({
          role: m.sender,
          content: m.text,
          attachments: m.attachments || []
        }));

      await chatWithBot(
        payloadMessages, 
        selectedModel, 
        abortControllerRef.current.signal, 
        (chunkText) => {
          setSessions(prev => prev.map(s => {
            if (s.id === sessionIdToUse) {
              const updatedMessages = [...s.messages];
              const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
              if (aiMsgIndex !== -1) {
                 updatedMessages[aiMsgIndex] = {
                   ...updatedMessages[aiMsgIndex],
                   text: chunkText,
                   streamingStatus: "generating"
                 };
              }
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
        },
        (event) => {
          setSessions(prev => prev.map(s => {
            if (s.id === sessionIdToUse) {
              const updatedMessages = [...s.messages];
              const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
              if (aiMsgIndex !== -1) {
                 updatedMessages[aiMsgIndex] = {
                   ...updatedMessages[aiMsgIndex],
                   streamingStatus: event.status,
                   streamingMessage: event.message,
                   streamingSources: event.sources || updatedMessages[aiMsgIndex].streamingSources || []
                 };
              }
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
        }
      );
      
      // Jika selesai, hapus flag isStreaming
      setSessions(prev => prev.map(s => {
        if (s.id === sessionIdToUse) {
          const updatedMessages = [...s.messages];
          const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
          if (aiMsgIndex !== -1) {
             updatedMessages[aiMsgIndex] = {
               ...updatedMessages[aiMsgIndex],
               isStreaming: false
             };
          }
          return { ...s, messages: updatedMessages };
        }
        return s;
      }));

    } catch (err) {
      if (err.name === 'AbortError') {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionIdToUse) {
            const updatedMessages = [...s.messages];
            const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
            if (aiMsgIndex !== -1) {
               updatedMessages[aiMsgIndex] = {
                 ...updatedMessages[aiMsgIndex],
                 text: updatedMessages[aiMsgIndex].text + "\n\n*—Pembuatan pesan dihentikan oleh pengguna—*",
                 isStreaming: false
               };
            }
            return { ...s, messages: updatedMessages };
          }
          return s;
        }));
      } else {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionIdToUse) {
            const updatedMessages = [...s.messages];
            const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
            if (aiMsgIndex !== -1) {
               updatedMessages[aiMsgIndex] = {
                 ...updatedMessages[aiMsgIndex],
                 text: err.message || "Maaf, terjadi kesalahan saat menghubungi server Factize.",
                 isStreaming: false
               };
            }
            return { ...s, messages: updatedMessages };
          }
          return s;
        }));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleEditSendMessage = async (messageId, newText) => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    const msgIndex = session.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Hapus semua pesan di bawah pesan yang diedit
    const slicedMessages = session.messages.slice(0, msgIndex + 1);

    // Update isi teks pesan ini
    slicedMessages[msgIndex] = {
      ...slicedMessages[msgIndex],
      text: newText,
      timestamp: new Date().toISOString()
    };

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // Buat placeholder kosong untuk pesan AI yang baru di bawah pesan diedit
    const tempAiMsgId = (Date.now() + 1).toString();
    const tempAiMessage = {
      id: tempAiMsgId,
      text: "",
      sender: "ai",
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    const finalMessages = [...slicedMessages, tempAiMessage];

    // Simpan ke state
    setSessions(prev => prev.map(s => s.id === currentSessionId ? {
      ...s,
      messages: finalMessages,
      timestamp: new Date().toISOString()
    } : s));

    try {
      const payloadMessages = slicedMessages
        .filter(m => m.id !== "welcome" && m.id !== "welcome-new")
        .map(m => ({
          role: m.sender,
          content: m.text,
          attachments: m.attachments || []
        }));

      await chatWithBot(
        payloadMessages, 
        selectedModel, 
        abortControllerRef.current.signal, 
        (chunkText) => {
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const updatedMessages = [...s.messages];
              const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
              if (aiMsgIndex !== -1) {
                 updatedMessages[aiMsgIndex] = {
                   ...updatedMessages[aiMsgIndex],
                   text: chunkText,
                   streamingStatus: "generating"
                 };
              }
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
        },
        (event) => {
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const updatedMessages = [...s.messages];
              const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
              if (aiMsgIndex !== -1) {
                 updatedMessages[aiMsgIndex] = {
                   ...updatedMessages[aiMsgIndex],
                   streamingStatus: event.status,
                   streamingMessage: event.message,
                   streamingSources: event.sources || updatedMessages[aiMsgIndex].streamingSources || []
                 };
              }
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
        }
      );
      
      // Selesai streaming, hapus flag isStreaming
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const updatedMessages = [...s.messages];
          const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
          if (aiMsgIndex !== -1) {
             updatedMessages[aiMsgIndex] = {
               ...updatedMessages[aiMsgIndex],
               isStreaming: false
             };
          }
          return { ...s, messages: updatedMessages };
        }
        return s;
      }));

    } catch (err) {
      if (err.name === 'AbortError') {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const updatedMessages = [...s.messages];
            const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
            if (aiMsgIndex !== -1) {
               updatedMessages[aiMsgIndex] = {
                 ...updatedMessages[aiMsgIndex],
                 text: updatedMessages[aiMsgIndex].text + "\n\n*—Pembuatan pesan dihentikan oleh pengguna—*",
                 isStreaming: false
               };
            }
            return { ...s, messages: updatedMessages };
          }
          return s;
        }));
      } else {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const updatedMessages = [...s.messages];
            const aiMsgIndex = updatedMessages.findIndex(m => m.id === tempAiMsgId);
            if (aiMsgIndex !== -1) {
               updatedMessages[aiMsgIndex] = {
                 ...updatedMessages[aiMsgIndex],
                 text: err.message || "Maaf, terjadi kesalahan saat menghubungi server Factize.",
                 isStreaming: false
               };
            }
            return { ...s, messages: updatedMessages };
          }
          return s;
        }));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerate = () => {
    if (!currentSessionId) return;
    
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        let lastAiIndex = -1;
        for (let i = s.messages.length - 1; i >= 0; i--) {
          if (s.messages[i].sender === "ai") {
            lastAiIndex = i;
            break;
          }
        }
        
        if (lastAiIndex !== -1) {
          const newMsgList = [...s.messages];
          newMsgList.splice(lastAiIndex, 1);
          return { ...s, messages: newMsgList };
        }
      }
      return s;
    }));

    setTimeout(() => {
      handleSendMessage("", [], true);
    }, 100);
  };

  const handleNewCheck = () => {
    if (isLoading && abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentSessionId(null);
    setIsMobileMenuOpen(false);
  };

  const handleSelectSession = (id) => {
    if (isLoading && abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentSessionId(id);
    setIsMobileMenuOpen(false);
  };

  const handleDeleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      if (isLoading && abortControllerRef.current) abortControllerRef.current.abort();
      setCurrentSessionId(null);
    }
  };

  const handleClearAllHistory = () => {
    if (isLoading && abortControllerRef.current) abortControllerRef.current.abort();
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(CURRENT_SESSION_KEY);
    setSessions([]);
    setCurrentSessionId(null);
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden relative font-sans bg-[#FFFDF6]">
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <div className={`
        fixed lg:relative z-40 h-full
        transform transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarOpen ? 'lg:w-72 xl:lg:w-80' : 'lg:w-16'}
      `}>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggleSidebar={setIsSidebarOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          sessions={sessions}
          currentSessionId={currentSessionId}
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            setIsMobileMenuOpen(false);
          }}
          onNewCheck={handleNewCheck}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>
      
      {currentView === 'chat' ? (
        <ChatArea 
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={setIsSidebarOpen}
          onOpenInfo={() => setShowInfoModal(true)}
          messages={messages} 
          onSendMessage={handleSendMessage}
          onEditSendMessage={handleEditSendMessage}
          isLoading={isLoading}
          onStopGeneration={handleStopGeneration}
          onRegenerate={handleRegenerate}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      ) : (
        <div className="flex-1 flex flex-col h-full bg-[#FFFDF6]">
          <div className="flex-1 overflow-y-auto pt-20 lg:pt-0">
            <DetectorAI onOpenInfo={() => setShowInfoModal(true)} />
          </div>
        </div>
      )}
      {!isMobileMenuOpen && (
        <MobileTopBar 
          isOpen={isMobileMenuOpen}
          onToggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          currentView={currentView}
          onOpenInfo={() => setShowInfoModal(true)}
        />
      )}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onClearHistory={handleClearAllHistory}
      />

      {/* ── Info Modal (Disclosure) optimized for mobile GPU & blurs ── */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#17221E]/75 lg:bg-[#17221E]/40 lg:backdrop-blur-md px-4 transform-gpu"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-[#FFFDF6] border border-[#21302A]/10 shadow-[0_20px_50px_rgba(33,48,42,0.15)] rounded-3xl p-6 md:p-8 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] transform-gpu"
              onClick={(e) => e.stopPropagation()}
            >
              {currentView === 'chat' ? (
                <>
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
                    className="text-[#5C6E60] text-[14px] leading-relaxed space-y-5 overflow-y-auto sidebar-scroll pr-2 flex-1 scrollbar-thin"
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
                </>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6 border-b border-[#21302A]/10 pb-4">
                    <div className="p-3 bg-[#E5EBE8] text-[#21302A] rounded-2xl shadow-sm">
                      <ScanLine className="w-7 h-7 text-[#21302A]" />
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
                    className="text-[#5C6E60] text-[14px] leading-relaxed space-y-5 overflow-y-auto sidebar-scroll pr-2 flex-1 scrollbar-thin"
                  >
                    <p>
                      <strong>Truth Scan</strong> adalah fitur pintar untuk mengidentifikasi apakah suatu gambar dihasilkan oleh kecerdasan buatan (AI) atau merupakan foto jepretan kamera asli.
                    </p>

                    {/* Grid Metrik */}
                    <div className="space-y-3">
                      <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 hover:border-[#21302A]/10 transition-all shadow-sm">
                        <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                          <Cpu className="w-4.5 h-4.5 text-indigo-650" /> Detektor AI Google SigLIP
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

                    {/* PEMBERITAHUAN PENTING */}
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
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
