import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brain, Zap, Globe, Cpu, ScanLine, FileSearch, AlertTriangle, Info, Radio } from "lucide-react";
import { translations } from "../services/translations";

export function InfoModal({ isOpen, onClose, currentView, language }) {
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const scrollRef = useRef(null);
  const t = translations[language || "id"];

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      // Ditambah offset 10px untuk sensitivitas gulir di layar sentuh mobile
      const isBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
      if (isBottom) {
        setHasReadToBottom(true);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setHasReadToBottom(false);
      // Cek apakah konten sudah langsung muat di viewport tanpa perlu scroll
      setTimeout(() => {
        const element = scrollRef.current;
        if (element) {
          if (element.scrollHeight <= element.clientHeight + 15) {
            setHasReadToBottom(true);
          }
        }
      }, 150);
    }
  }, [isOpen, currentView]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 transform-gpu">
          {/* Backdrop Blur dengan optimasi render GPU */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-[#17221E]/60 backdrop-blur-[4px] pointer-events-auto"
            onClick={onClose}
          />

          {/* Modal Sheet / Body */}
          <motion.div
            // Menggunakan slide-up di mobile (< 768px) dan zoom di desktop
            initial={
              window.innerWidth < 768 
                ? { y: "100%", opacity: 0.9 } 
                : { scale: 0.96, opacity: 0, y: 10 }
            }
            animate={
              window.innerWidth < 768 
                ? { y: 0, opacity: 1 } 
                : { scale: 1, opacity: 1, y: 0 }
            }
            exit={
              window.innerWidth < 768 
                ? { y: "100%", opacity: 0.9 } 
                : { scale: 0.96, opacity: 0, y: 10 }
            }
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#FFFDF6] border-t border-x border-[#21302A]/10 md:border md:border-[#21302A]/10 shadow-[0_20px_50px_rgba(33,48,42,0.15)] 
              w-full max-w-lg overflow-hidden flex flex-col pointer-events-auto z-10 font-sans transform-gpu
              rounded-t-[32px] max-h-[85vh] p-6 pb-8
              md:rounded-3xl md:max-h-[80vh] md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle visual indicator untuk mobile */}
            <div className="md:hidden w-12 h-1.5 bg-[#21302A]/10 rounded-full mx-auto mb-5 flex-shrink-0" />

            {currentView === 'chat' && (
              <>
                {/* Header Chat */}
                <div className="flex items-center gap-4 mb-5 border-b border-[#21302A]/10 pb-4">
                  <div className="p-3 bg-[#E5EBE8] text-[#21302A] rounded-2xl shadow-sm flex-shrink-0">
                    <Brain className="w-6.5 h-6.5 text-[#6366F1]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl text-[#21302A] leading-tight">{t.chatGuideTitle}</h3>
                    <p className="text-xs text-[#5C6E60] mt-0.5">{t.chatGuideSub}</p>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div 
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="text-[#5C6E60] text-[14px] leading-relaxed space-y-4 overflow-y-auto sidebar-scroll pr-2 flex-1 scrollbar-thin touch-pan-y"
                >
                  <p>{t.chatGuideIntro}</p>

                  <div className="space-y-3">
                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Zap className="w-4.5 h-4.5 text-amber-500" fill="currentColor"/> {t.modelFlashTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.modelFlashDesc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Brain className="w-4.5 h-4.5 text-[#6366F1]"/> {t.modelProTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.modelProDesc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Globe className="w-4.5 h-4.5 text-blue-500"/> {t.webSearchTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.webSearchDesc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Cpu className="w-4.5 h-4.5 text-emerald-600"/> {t.typoTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.typoDesc}</p>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex gap-3 text-amber-950 shadow-inner">
                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[13px] text-amber-850 mb-1">{t.memoryTitle}</h4>
                      <p className="text-[11px] leading-relaxed text-amber-900/85">{t.memoryDesc}</p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-5 pt-4 border-t border-[#21302A]/10">
                  <button 
                    disabled={!hasReadToBottom}
                    onClick={onClose}
                    className={`w-full py-3 rounded-2xl font-semibold transition-all duration-200 shadow-md ${
                      hasReadToBottom 
                        ? 'bg-[#21302A] text-[#FFFDF6] hover:bg-[#2F443C] active:scale-[0.98] cursor-pointer shadow-[#21302A]/10' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {hasReadToBottom ? t.agreeChat : t.agreeScroll}
                  </button>
                </div>
              </>
            )}

            {currentView === 'radar' && (
              <>
                {/* Header Radar */}
                <div className="flex items-center gap-4 mb-5 border-b border-[#21302A]/10 pb-4">
                  <div className="p-3 bg-[#E5EBE8] text-[#21302A] rounded-2xl shadow-sm flex-shrink-0">
                    <Radio className="w-6.5 h-6.5 text-[#2A3A34]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl text-[#21302A] leading-tight">{t.radarGuideTitle}</h3>
                    <p className="text-xs text-[#5C6E60] mt-0.5">{t.radarGuideSub}</p>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div 
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="text-[#5C6E60] text-[14px] leading-relaxed space-y-4 overflow-y-auto sidebar-scroll pr-2 flex-1 scrollbar-thin touch-pan-y"
                >
                  <p>{t.radarGuideIntro}</p>

                  <div className="space-y-3">
                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Cpu className="w-4.5 h-4.5 text-[#2A3A34]" /> {t.radarGuideCard1Title}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.radarGuideCard1Desc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Globe className="w-4.5 h-4.5 text-blue-500" /> {t.radarGuideCard2Title}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.radarGuideCard2Desc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Zap className="w-4.5 h-4.5 text-amber-500" fill="currentColor" /> {t.radarGuideCard3Title}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.radarGuideCard3Desc}</p>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex gap-3 text-amber-950 shadow-inner">
                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[13px] text-amber-850 mb-1">{t.radarTipTitle}</h4>
                      <p className="text-[11px] leading-relaxed text-amber-900/85">{t.radarTipDesc}</p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-5 pt-4 border-t border-[#21302A]/10">
                  <button 
                    disabled={!hasReadToBottom}
                    onClick={onClose}
                    className={`w-full py-3 rounded-2xl font-semibold transition-all duration-200 shadow-md ${
                      hasReadToBottom 
                        ? 'bg-[#21302A] text-[#FFFDF6] hover:bg-[#2F443C] active:scale-[0.98] cursor-pointer shadow-[#21302A]/10' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {hasReadToBottom ? t.agreeRadar : t.agreeScroll}
                  </button>
                </div>
              </>
            )}

            {currentView === 'detector' && (
              <>
                {/* Header Detector */}
                <div className="flex items-center gap-4 mb-5 border-b border-[#21302A]/10 pb-4">
                  <div className="p-3 bg-[#E5EBE8] text-[#21302A] rounded-2xl shadow-sm flex-shrink-0">
                    <ScanLine className="w-6.5 h-6.5 text-[#21302A]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl text-[#21302A] leading-tight">{t.detectorGuideTitle}</h3>
                    <p className="text-xs text-[#5C6E60] mt-0.5">{t.detectorGuideSub}</p>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div 
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="text-[#5C6E60] text-[14px] leading-relaxed space-y-4 overflow-y-auto sidebar-scroll pr-2 flex-1 scrollbar-thin touch-pan-y"
                >
                  <p>{t.detectorGuideIntro}</p>

                  <div className="space-y-3">
                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <Cpu className="w-4.5 h-4.5 text-indigo-650" /> {t.siglipTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.siglipDesc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <ScanLine className="w-4.5 h-4.5 text-emerald-600" /> {t.elaTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.elaDesc}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-[#21302A]/5 shadow-sm">
                      <h4 className="font-bold text-[#21302A] flex items-center gap-2 mb-1">
                        <FileSearch className="w-4.5 h-4.5 text-amber-600" /> {t.exifTitle}
                      </h4>
                      <p className="text-xs text-[#5C6E60] leading-normal">{t.exifDesc}</p>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex gap-3 text-amber-950 shadow-inner">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[13px] text-amber-850 mb-1">{t.warningTitle}</h4>
                      <p className="text-[11px] leading-relaxed text-amber-900/85">{t.warningDesc}</p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-5 pt-4 border-t border-[#21302A]/10">
                  <button 
                    disabled={!hasReadToBottom}
                    onClick={onClose}
                    className={`w-full py-3 rounded-2xl font-semibold transition-all duration-200 shadow-md ${
                      hasReadToBottom 
                        ? 'bg-[#21302A] text-[#FFFDF6] hover:bg-[#2F443C] active:scale-[0.98] cursor-pointer shadow-[#21302A]/10' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {hasReadToBottom ? t.agreeScan : t.agreeScroll}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
