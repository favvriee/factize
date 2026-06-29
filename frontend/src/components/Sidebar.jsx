import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, MessageSquare, Trash2, ShieldCheck, Search, ScanLine, MessageCircle, Menu, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function Sidebar({ 
  isOpen, 
  onToggleSidebar, 
  onCloseMobileMenu,
  onOpenSettings,
  sessions, 
  currentSessionId, 
  currentView, 
  onViewChange, 
  onNewCheck, 
  onSelectSession, 
  onDeleteSession 
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = () => closeMenu();
    const onKey = (e) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu, closeMenu]);

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 60);
    setContextMenu({ id, x, y });
  };

  const handleDelete = () => {
    if (contextMenu) { onDeleteSession(contextMenu.id); closeMenu(); }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);
    
    if (diff < 0) return "Baru saja";
    if (hours > 24) return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    if (hours > 0) return `${hours} jam lalu`;
    if (minutes > 0) return `${minutes} mnt lalu`;
    return "Baru saja";
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* ── Collapsed Sidebar Rail View (Desktop only: visible when isOpen is false) ── */}
      {!isOpen && (
        <div className="hidden lg:flex w-16 bg-[#EFF3F1] border-r border-[#21302A]/8 flex-col h-full items-center py-5 select-none transition-all duration-300">
          
          {/* Top Brand Logo / Menu Hover Toggle */}
          <div 
            className="w-10 h-10 flex items-center justify-center relative cursor-pointer group mb-6"
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            onClick={() => onToggleSidebar(true)}
          >
            <AnimatePresence mode="wait">
              {isLogoHovered ? (
                <motion.div 
                  key="menu-icon"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-9 h-9 rounded-full bg-[#21302A]/5 flex items-center justify-center text-[#21302A]"
                >
                  <PanelLeftOpen className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div 
                  key="logo-icon"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-8 h-8 rounded-lg overflow-hidden shadow-sm flex items-center justify-center flex-shrink-0"
                >
                  <img src="/logo1.png" alt="Factize Logo" className="w-full h-full object-cover" />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Tooltip */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
              Buka sidebar
            </div>
          </div>

          {/* Quick Action: Cek Fakta Baru */}
          <div className="relative group mb-5">
            <button 
              onClick={() => {
                onViewChange('chat');
                onNewCheck();
              }}
              className="w-10 h-10 rounded-xl bg-[#21302A] hover:bg-[#2A3A34] text-[#FFFDF6] flex items-center justify-center transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>
            <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
              Cek Fakta Baru
            </div>
          </div>

          {/* Navigation Views */}
          <div className="flex flex-col gap-2.5 w-full items-center border-b border-[#21302A]/8 pb-4 mb-4">
            <div className="relative group">
              <button
                onClick={() => onViewChange('chat')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer
                  ${currentView === 'chat' 
                    ? 'bg-white shadow-sm border border-[#21302A]/5 text-[#21302A]' 
                    : 'text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A]'}`}
              >
                <MessageSquare className="w-4.5 h-4.5" />
              </button>
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
                Chat Cek Fakta
              </div>
            </div>

            {/* Search History Glass Trigger */}
            <div className="relative group">
              <button
                onClick={() => {
                  onToggleSidebar(true);
                  setTimeout(() => {
                    const searchInput = document.getElementById("sidebar-search-input");
                    if (searchInput) searchInput.focus();
                  }, 150);
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A]"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
                Cari Riwayat
              </div>
            </div>

            <div className="relative group">
              <button
                onClick={() => onViewChange('detector')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer
                  ${currentView === 'detector' 
                    ? 'bg-white shadow-sm border border-[#21302A]/5 text-[#21302A]' 
                    : 'text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A]'}`}
              >
                <ScanLine className="w-4.5 h-4.5" />
              </button>
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
                AI Image Detector
              </div>
            </div>
          </div>

          {/* Bottom: Settings & Profile */}
          <div className="mt-auto flex flex-col gap-3 items-center">
            {/* Settings trigger button */}
            <div className="relative group">
              <button 
                onClick={onOpenSettings}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A]"
                title="Pengaturan"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
                Pengaturan
              </div>
            </div>

            <div className="relative group">
              <div className="w-10 h-10 rounded-[10px] overflow-hidden shadow-xs border border-[#21302A]/8 flex items-center justify-center bg-white cursor-help">
                <img src="/logo1.png" alt="Factize" className="w-full h-full object-cover" />
              </div>
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#21302A] text-[#FFFDF6] text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-sans z-50 font-semibold tracking-wide">
                Factize AI Assistant
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded Sidebar View (Visible on mobile, or on desktop when isOpen is true) ── */}
      <div className={`
        ${isOpen ? 'flex' : 'flex lg:hidden'}
        w-72 xl:w-80 bg-[#EFF3F1] border-r border-[#21302A]/8 flex-col h-full transition-all duration-300
      `}>
        {/* Brand lockup */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                <img src="/logo1.png" alt="Factize Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-f1 text-[#21302A] text-[22px] tracking-wide leading-none select-none">
                Factize
              </span>
            </div>
            
            {/* Collapse toggle (Desktop only) */}
            <button 
              onClick={() => onToggleSidebar(false)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A] transition-colors cursor-pointer select-none active:scale-95"
              title="Tutup sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>

            {/* Close Mobile Menu (Mobile only) */}
            <button 
              onClick={onCloseMobileMenu}
              className="flex lg:hidden items-center justify-center w-8 h-8 rounded-full text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A] transition-colors cursor-pointer select-none active:scale-95"
              title="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Z.ai Style View Toggle */}
          <div className="flex flex-col gap-1 mb-6 border-b border-[#21302A]/8 pb-4 select-none">
            <button
              onClick={() => onViewChange('chat')}
              className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer
                ${currentView === 'chat' 
                  ? 'bg-white shadow-sm border border-[#21302A]/5 text-[#21302A]' 
                  : 'text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A]'}`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => onViewChange('detector')}
              className={`flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer
                ${currentView === 'detector' 
                  ? 'bg-white shadow-sm border border-[#21302A]/5 text-[#21302A]' 
                  : 'text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A]'}`}
            >
              <ScanLine className="w-4 h-4" />
              AI Image Detector
            </button>
          </div>

          <button 
            onClick={() => {
              onViewChange('chat');
              onNewCheck();
            }}
            className="w-full bg-[#21302A] hover:bg-[#2A3A34] text-[#FFFDF6] py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all active:scale-[0.98] shadow-sm mb-2 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            Cek Fakta Baru
          </button>
          
          {/* Search bar */}
          <div className="relative select-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#21302A]/40" />
            <input 
              id="sidebar-search-input"
              type="text" 
              placeholder="Cari riwayat..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#E5EBE8] text-[#21302A] placeholder:text-[#21302A]/40 text-xs px-9 py-2.5 rounded-full outline-none focus:ring-1 ring-[#21302A]/20 transition-all"
            />
          </div>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto sidebar-scroll px-3 pb-4">
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {filteredSessions.map((session) => {
                const isActive = session.id === currentSessionId;
                
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div
                      onClick={() => onSelectSession(session.id)}
                      onContextMenu={(e) => handleContextMenu(e, session.id)}
                      className={`group flex items-start gap-3 rounded-[12px] px-3 py-2.5 cursor-pointer transition-colors border select-none ${
                        isActive 
                          ? "bg-[#FFFDF6] border-[#21302A]/10 shadow-[0_2px_8px_rgba(33,48,42,0.04)]" 
                          : "border-transparent hover:bg-[#E5EBE8] text-[#21302A]/80"
                      }`}
                    >
                      <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-[#21302A]' : 'text-[#21302A]/40'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate leading-tight mb-1 ${isActive ? 'font-semibold text-[#21302A]' : 'font-medium'}`}>
                          {session.title}
                        </p>
                        <p className="text-[10px] text-[#5C6E60] opacity-80">{formatTime(session.timestamp)}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {sessions.length === 0 && (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-[#5C6E60]">Belum ada riwayat percakapan.</p>
              </div>
            )}
            
            {sessions.length > 0 && filteredSessions.length === 0 && (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-[#5C6E60]">Pencarian tidak ditemukan.</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Profile card & Settings */}
        <div className="p-4 border-t border-[#21302A]/8 select-none flex flex-col gap-2">
          {/* Settings Trigger */}
          <button 
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold text-[#5C6E60] hover:bg-[#21302A]/5 hover:text-[#21302A] cursor-pointer"
          >
            <Settings className="w-4.5 h-4.5" />
            Pengaturan
          </button>
          
          <div className="bg-[#F4F7F6] rounded-[8px] p-3 border border-[#21302A]/8">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-[10px] flex flex-col items-center justify-center shadow-sm overflow-hidden">
                  <img src="/logo1.png" alt="Factize" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#F4F7F6] rounded-full" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-f1 text-[#21302A] text-[15px] leading-none">Factize</span>
                </div>
                <p className="text-[10px] text-[#5C6E60] mt-0.5 uppercase tracking-wider font-semibold">AI Assistant</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right-click context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            ref={menuRef}
            key="ctx"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}
            className="bg-white rounded-[8px] shadow-[0_8px_32px_rgba(33,48,42,0.18)] border border-[#21302A]/10 py-1 min-w-[180px] origin-top-left select-none"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#D9534F] hover:bg-[#FDF3F3] transition-colors font-medium cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Hapus Percakapan</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
