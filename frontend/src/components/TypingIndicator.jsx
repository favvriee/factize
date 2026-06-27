import React from "react";

export function TypingIndicator() {
  return (
    <div className="flex justify-start items-start gap-2.5">
      <div className="flex-shrink-0 w-8 h-8 bg-[#21302A] rounded-full flex items-center justify-center mt-0.5 shadow-sm">
        <span className="text-xs font-f1 text-[#FFFDF6] leading-none tracking-tight">SF</span>
      </div>
      <div className="bg-[#F7F4E9] rounded-[16px] rounded-tl-[4px] px-5 py-3.5 shadow-sm border border-[#21302A]/5">
        <div className="flex gap-1.5 items-center h-4">
          <div className="w-2 h-2 bg-[#5C6E60] rounded-full typing-dot" />
          <div className="w-2 h-2 bg-[#5C6E60] rounded-full typing-dot" style={{ animationDelay: "0.18s" }} />
          <div className="w-2 h-2 bg-[#5C6E60] rounded-full typing-dot" style={{ animationDelay: "0.36s" }} />
        </div>
      </div>
    </div>
  );
}
