import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { DetectorAI } from "./components/DetectorAI";
import { MobileMenuButton } from "./components/MobileMenuButton";
import { chatWithBot } from "./services/api";
import { Menu } from "lucide-react";
import "./styles/index.css";


export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Collapsed by default (Gemini style)
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'detector'
  const [isLoading, setIsLoading] = useState(false);
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
          sessions={sessions}
          currentSessionId={currentSessionId}
          currentView={currentView}
          onViewChange={setCurrentView}
          onNewCheck={handleNewCheck}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>
      
      {currentView === 'chat' ? (
        <ChatArea 
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={setIsSidebarOpen}
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
          {/* Top Header wrapper for DetectorAI */}
          <div className="h-16 px-4 md:px-8 border-b border-[#21302A]/8 flex items-center bg-white z-20">
            <h1 className="text-md font-bold text-[#21302A] ml-2">AI Image Detector</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DetectorAI />
          </div>
        </div>
      )}
      <MobileMenuButton 
        isOpen={isMobileMenuOpen}
        onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
    </div>
  );
}
