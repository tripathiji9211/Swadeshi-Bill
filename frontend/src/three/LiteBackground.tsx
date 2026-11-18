import React from 'react';

export const LiteBackground: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#000000] ${className}`}
      aria-hidden="true"
    >
      {/* Subtle Indian Kolam / Rangoli geometric grid background */}
      <div className="absolute inset-0 bg-grid-tech opacity-20" />

      {/* Center glowing diya aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#FF9933]/15 via-[#D4A017]/10 to-transparent blur-3xl pointer-events-none animate-pulse" />

      {/* 24-spoke abstract chakra ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] pointer-events-none opacity-25">
        <svg viewBox="0 0 200 200" className="w-full h-full animate-[spin_60s_linear_infinite]">
          <circle cx="100" cy="100" r="94" stroke="#FF9933" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="80" stroke="#D4A017" strokeWidth="0.8" fill="none" />
          <circle cx="100" cy="100" r="24" stroke="#FF9933" strokeWidth="1.5" fill="none" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 24 * Math.cos(rad);
            const y1 = 100 + 24 * Math.sin(rad);
            const x2 = 100 + 80 * Math.cos(rad);
            const y2 = 100 + 80 * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#D4A017"
                strokeWidth="0.75"
                opacity="0.8"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default LiteBackground;
