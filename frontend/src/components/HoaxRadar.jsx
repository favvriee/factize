import React, { useState, useEffect } from "react";
import { RefreshCw, Radio, AlertTriangle, ShieldCheck, Link as LinkIcon, ArrowRight, Loader2, Info } from "lucide-react";
import { motion } from "motion/react";
import { translations } from "../services/translations";

export default function HoaxRadar({ language, onVerifyHoax, onOpenInfo }) {
  const t = translations[language || "id"];
  const [hoaxes, setHoaxes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchHoaxes = async () => {
    try {
      setError(null);
      const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiBase}/api/trending`);
      if (!response.ok) throw new Error("Gagal memuat data tren.");
      const data = await response.json();
      setHoaxes(data);
    } catch (err) {
      console.error(err);
      setError(language === "en" ? "Failed to load hoax radar data." : "Gagal memuat data radar hoaks.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const headers = { "Content-Type": "application/json" };
      const customGeminiKey = localStorage.getItem("sifakta_gemini_key");
      if (customGeminiKey) {
        headers["X-Gemini-API-Key"] = customGeminiKey;
      }

      const response = await fetch(`${apiBase}/api/trending/refresh`, {
        method: "POST",
        headers
      });
      if (!response.ok) throw new Error("Gagal melakukan penyegaran AI.");
      const resData = await response.json();
      if (resData.status === "success" && resData.data) {
        setHoaxes(resData.data);
      } else {
        throw new Error("Format data tidak sesuai.");
      }
    } catch (err) {
      console.error(err);
      setError(language === "en" ? "Failed to connect to AI for refresh." : "Gagal menghubungi AI untuk memutakhirkan data.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHoaxes();
  }, []);

  const getSeverityStyles = (severity) => {
    switch (severity?.toLowerCase()) {
      case "high":
        return "bg-red-50 text-[#BC4C4C] border border-red-100 dark:bg-red-950/20";
      case "medium":
        return "bg-amber-50 text-[#D9822B] border border-amber-100 dark:bg-amber-950/20";
      default:
        return "bg-emerald-50 text-[#2F855A] border border-emerald-100 dark:bg-emerald-950/20";
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity?.toLowerCase()) {
      case "high":
        return t.radarCardSeverityHigh;
      case "medium":
        return t.radarCardSeverityMed;
      default:
        return t.radarCardSeverityLow;
    }
  };

  const getCategoryLabel = (category) => {
    if (category === "Penipuan / Scams" || category === "Penipuan") {
      return t.radarCardCategoryScam;
    } else if (category === "Kesehatan / Health" || category === "Kesehatan") {
      return t.radarCardCategoryHealth;
    } else {
      return t.radarCardCategoryPublic;
    }
  };

  const getCategoryIcon = (category) => {
    if (category === "Penipuan / Scams" || category === "Penipuan") {
      return <LinkIcon className="w-3.5 h-3.5" />;
    } else if (category === "Kesehatan / Health" || category === "Kesehatan") {
      return <ShieldCheck className="w-3.5 h-3.5" />;
    } else {
      return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10 select-none">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-[#2A3A34]/10 rounded-lg text-[#2A3A34] animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-extrabold text-[#21302A] tracking-tight">
              {t.radarHeading}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#5C6E60] max-w-2xl font-medium leading-relaxed">
            {t.radarSubheading}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          {/* Info Modal Button (Visible on desktop/PC) */}
          <button
            onClick={onOpenInfo}
            className="inline-flex items-center justify-center gap-1.5 text-[#5C6E60] hover:text-[#21302A] hover:bg-[#21302A]/5 px-3 py-2 rounded-xl transition-colors text-xs font-semibold border border-[#21302A]/10 bg-transparent active:scale-95"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Info</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center justify-center gap-2 bg-[#2A3A34] hover:bg-[#1E2B25] disabled:bg-[#2A3A34]/50 text-white text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all disabled:pointer-events-none shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? t.radarRefreshLoading : t.radarRefreshBtn}</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-[#BC4C4C] p-4 rounded-2xl text-xs md:text-sm font-semibold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-[#2A3A34] animate-spin" />
          <span className="text-xs font-semibold text-[#5C6E60] animate-pulse">
            {language === "en" ? "Fetching community news..." : "Mengambil informasi komunitas..."}
          </span>
        </div>
      ) : hoaxes.length === 0 ? (
        <div className="text-center py-16 text-xs text-[#5C6E60] font-semibold">
          {language === "en" ? "No trending hoaxes found." : "Belum ada tren hoaks terpopuler yang tercatat."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {hoaxes.map((hoax, idx) => (
            <motion.div
              key={hoax.id || idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-[#FFFDF6]/45 backdrop-blur-md border border-[#21302A]/10 p-5 rounded-2xl shadow-xs hover:border-[#21302A]/25 hover:bg-white/80 active:scale-[0.98] transition-all flex flex-col justify-between"
            >
              <div>
                {/* Meta Indicators */}
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#2A3A34] bg-[#2A3A34]/5 px-2.5 py-0.5 rounded-full">
                    {getCategoryIcon(hoax.category)}
                    <span>{getCategoryLabel(hoax.category)}</span>
                  </div>

                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getSeverityStyles(hoax.severity)}`}>
                    {getSeverityLabel(hoax.severity)}
                  </span>
                </div>

                {/* Hoax Title */}
                <h3 className="text-sm md:text-[15px] font-bold text-[#21302A] leading-snug tracking-tight mb-2 line-clamp-2">
                  {hoax.title}
                </h3>

                {/* Hoax Description */}
                <p className="text-[11px] md:text-xs text-[#5C6E60] font-medium leading-relaxed mb-4 line-clamp-3">
                  {hoax.description}
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onVerifyHoax(hoax.query)}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-[#FFFDF6] hover:bg-[#F2EDE0] border border-[#21302A]/12 text-[#21302A] text-xs font-bold py-2 rounded-xl active:scale-[0.97] transition-all"
              >
                <span>{t.radarCardVerifyBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
