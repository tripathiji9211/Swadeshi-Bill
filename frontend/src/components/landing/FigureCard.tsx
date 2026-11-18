import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionMode } from '@/hooks/useMotionMode';

export interface FigureCardProps {
  figureId: string; // e.g. "FIG 0.1 // UNIFIED VIEW"
  title: string;
  description: string;
  type: 'unified-view' | 'decision-graph' | 'automated-rhythm';
  className?: string;
}

export const FigureCard: React.FC<FigureCardProps> = ({
  figureId,
  title,
  description,
  type,
  className,
}) => {
  const { reduceMotion } = useMotionMode();

  return (
    <div
      className={cn(
        'group relative bg-[#0A0A0A] border border-[#1C1C1F] rounded p-6 flex flex-col justify-between overflow-hidden transition-colors hover:border-[#2A2A2E]',
        className
      )}
    >
      {/* Corner crosshairs */}
      <span className="absolute top-2 left-2 font-mono text-[9px] text-[#52555C] select-none pointer-events-none">
        +
      </span>
      <span className="absolute top-2 right-2 font-mono text-[9px] text-[#52555C] select-none pointer-events-none">
        +
      </span>

      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 border-b border-[#1C1C1F] pb-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#52555C]">
          {figureId}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933] opacity-80" />
      </div>

      {/* Visual Canvas Area */}
      <div className="h-44 w-full my-2 bg-[#000000] border border-[#1C1C1F]/60 rounded flex items-center justify-center p-3 relative overflow-hidden bg-grid-tech">
        {type === 'unified-view' && (
          <svg className="w-full h-full" viewBox="0 0 240 120" fill="none">
            {/* Receipt Box */}
            <rect
              x="15"
              y="20"
              width="50"
              height="70"
              rx="2"
              stroke="#52555C"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <line x1="25" y1="35" x2="55" y2="35" stroke="#52555C" strokeWidth="1" />
            <line x1="25" y1="45" x2="48" y2="45" stroke="#52555C" strokeWidth="1" />
            <line x1="25" y1="55" x2="52" y2="55" stroke="#52555C" strokeWidth="1" />

            {/* Connecting Arrow */}
            <motion.path
              d="M 70 55 L 105 55"
              stroke="#FF9933"
              strokeWidth="1"
              animate={reduceMotion ? {} : { strokeDashoffset: [0, -20] }}
              strokeDasharray="4 4"
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            />
            <polygon points="105,52 110,55 105,58" fill="#FF9933" />

            {/* OCR Processing Node */}
            <rect
              x="115"
              y="35"
              width="36"
              height="40"
              rx="3"
              stroke="#FF9933"
              strokeWidth="1"
              fill="#0A0A0A"
            />
            <text x="123" y="58" fill="#FF9933" fontSize="8" fontFamily="monospace">
              OCR
            </text>

            {/* Second Arrow */}
            <line x1="155" y1="55" x2="175" y2="55" stroke="#8B8DFF" strokeWidth="1" />
            <polygon points="175,52 180,55 175,58" fill="#8B8DFF" />

            {/* Structured JSON Box */}
            <rect
              x="185"
              y="20"
              width="45"
              height="70"
              rx="2"
              stroke="#8B8DFF"
              strokeWidth="1"
              fill="#0A0A0A"
            />
            <text x="193" y="38" fill="#EDEDED" fontSize="7" fontFamily="monospace">
              {'{'}
            </text>
            <text x="198" y="50" fill="#8A8F98" fontSize="6" fontFamily="monospace">
              "amt": 3450
            </text>
            <text x="198" y="62" fill="#8A8F98" fontSize="6" fontFamily="monospace">
              "cat": "supp"
            </text>
            <text x="193" y="74" fill="#EDEDED" fontSize="7" fontFamily="monospace">
              {'}'}
            </text>
          </svg>
        )}

        {type === 'decision-graph' && (
          <svg className="w-full h-full" viewBox="0 0 240 120" fill="none">
            {/* Center Hub */}
            <circle cx="120" cy="60" r="16" stroke="#EDEDED" strokeWidth="1" fill="#0A0A0A" />
            <text x="110" y="63" fill="#EDEDED" fontSize="8" fontFamily="monospace">
              EVAL
            </text>

            {/* Orbit Ring */}
            <circle
              cx="120"
              cy="60"
              r="40"
              stroke="#1C1C1F"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Node 1: Classifier */}
            <motion.g
              animate={reduceMotion ? {} : { rotate: 360 }}
              style={{ originX: '120px', originY: '60px' }}
              transition={{ repeat: Infinity, duration: 16, ease: 'linear' }}
            >
              <line x1="120" y1="60" x2="120" y2="20" stroke="#FF9933" strokeWidth="1" />
              <circle cx="120" cy="20" r="7" fill="#0A0A0A" stroke="#FF9933" strokeWidth="1" />

              <line x1="120" y1="60" x2="155" y2="80" stroke="#F87171" strokeWidth="1" />
              <circle cx="155" cy="80" r="7" fill="#0A0A0A" stroke="#F87171" strokeWidth="1" />

              <line x1="120" y1="60" x2="85" y2="80" stroke="#8B8DFF" strokeWidth="1" />
              <circle cx="85" cy="80" r="7" fill="#0A0A0A" stroke="#8B8DFF" strokeWidth="1" />
            </motion.g>

            {/* Labels */}
            <text x="80" y="15" fill="#52555C" fontSize="7" fontFamily="monospace">
              TF-IDF // RF
            </text>
            <text x="155" y="102" fill="#52555C" fontSize="7" fontFamily="monospace">
              ISOLATION_FOREST
            </text>
            <text x="25" y="102" fill="#52555C" fontSize="7" fontFamily="monospace">
              Z-SCORE_GATE
            </text>
          </svg>
        )}

        {type === 'automated-rhythm' && (
          <svg className="w-full h-full" viewBox="0 0 240 120" fill="none">
            {/* Grid line */}
            <line x1="10" y1="60" x2="230" y2="60" stroke="#1C1C1F" strokeWidth="1" />
            <line x1="10" y1="20" x2="230" y2="20" stroke="#1C1C1F" strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1="10" y1="100" x2="230" y2="100" stroke="#1C1C1F" strokeWidth="0.5" strokeDasharray="2 2" />

            {/* Sine wave path: Historical Spend */}
            <path
              d="M 15 60 Q 35 15, 60 60 T 110 60"
              stroke="#52555C"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Animated Projected Wave: Prophet/SARIMA Forecast */}
            <motion.path
              d="M 110 60 Q 135 25, 160 60 T 215 60"
              stroke="#FF9933"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              fill="none"
              animate={reduceMotion ? {} : { strokeDashoffset: [0, -24] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            />

            {/* Projected Confidence Upper/Lower Band */}
            <path
              d="M 110 60 Q 135 10, 160 50 T 215 45 L 215 75 Q 185 70, 160 70 T 110 60 Z"
              fill="rgba(45, 212, 212, 0.06)"
            />

            {/* Forecast Marker */}
            <circle cx="160" cy="60" r="3" fill="#FF9933" />
            <text x="165" y="55" fill="#FF9933" fontSize="7" fontFamily="monospace">
              T+30D // PROPHET
            </text>
          </svg>
        )}
      </div>

      {/* Title & Description */}
      <div className="mt-4">
        <h4 className="text-base text-[#EDEDED] font-normal mb-1 tracking-tight">
          {title}
        </h4>
        <p className="text-xs text-[#8A8F98] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

export default FigureCard;

