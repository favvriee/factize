import React from "react";
import { Menu, X } from "lucide-react";

export function MobileMenuButton({ isOpen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="lg:hidden absolute top-4 left-3 z-50 p-2 text-[#21302A] hover:bg-[#21302A]/5 rounded-md transition-colors"
      aria-label="Toggle menu"
    >
      {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
    </button>
  );
}
