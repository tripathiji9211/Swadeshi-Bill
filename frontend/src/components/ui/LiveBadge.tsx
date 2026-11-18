import React from 'react';
import { cn } from '@/lib/utils';

export interface LiveBadgeProps {
  label?: string;
  className?: string;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({
  label = 'LIVE',
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs border border-[#34D399]/30 bg-[#0A0A0A] font-mono text-[10px] tracking-[0.14em] text-[#34D399] uppercase select-none',
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      </span>
      <span>{label}</span>
    </span>
  );
};

export default LiveBadge;

