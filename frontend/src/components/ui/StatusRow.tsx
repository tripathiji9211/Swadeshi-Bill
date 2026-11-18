import React from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'cyan' | 'periwinkle' | 'ok' | 'warn' | 'danger' | 'dim';

export interface StatusRowProps {
  name: string;
  value: React.ReactNode;
  tone?: StatusTone;
  secondary?: string;
  className?: string;
  glow?: boolean;
}

const dotColors: Record<StatusTone, string> = {
  cyan: 'bg-[#FF9933]',
  periwinkle: 'bg-[#8B8DFF]',
  ok: 'bg-[#34D399]',
  warn: 'bg-[#F5B544]',
  danger: 'bg-[#F87171]',
  dim: 'bg-[#52555C]',
};

const dotGlows: Record<StatusTone, string> = {
  cyan: 'shadow-[0_0_8px_rgba(45,212,212,0.4)]',
  periwinkle: 'shadow-[0_0_8px_rgba(139,141,255,0.4)]',
  ok: 'shadow-[0_0_8px_rgba(52,211,153,0.4)]',
  warn: 'shadow-[0_0_8px_rgba(245,181,68,0.4)]',
  danger: 'shadow-[0_0_8px_rgba(248,113,113,0.4)]',
  dim: '',
};

export const StatusRow: React.FC<StatusRowProps> = ({
  name,
  value,
  tone = 'cyan',
  secondary,
  className,
  glow = true,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2 px-3 rounded-xs border border-transparent hover:border-[#1C1C1F] hover:bg-[#111111] transition-colors text-xs',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            dotColors[tone],
            glow && dotGlows[tone]
          )}
        />
        <span className="font-mono text-[11px] tracking-[0.06em] text-[#8A8F98] truncate uppercase">
          {name}
        </span>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-[#EDEDED] shrink-0">
        <span>{value}</span>
        {secondary && (
          <span className="text-[10px] text-[#52555C] uppercase">
            // {secondary}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusRow;

