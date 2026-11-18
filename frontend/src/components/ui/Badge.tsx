import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'cyan' | 'periwinkle' | 'ok' | 'warn' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
}

const toneStyles: Record<BadgeTone, { text: string; border: string; dot: string; glow: string }> = {
  neutral: {
    text: 'text-[#8A8F98]',
    border: 'border-[#2A2A2E]',
    dot: 'bg-[#52555C]',
    glow: '',
  },
  cyan: {
    text: 'text-[#FF9933]',
    border: 'border-[#FF9933]/30',
    dot: 'bg-[#FF9933]',
    glow: 'shadow-[0_0_8px_rgba(45,212,212,0.4)]',
  },
  periwinkle: {
    text: 'text-[#8B8DFF]',
    border: 'border-[#8B8DFF]/30',
    dot: 'bg-[#8B8DFF]',
    glow: 'shadow-[0_0_8px_rgba(139,141,255,0.4)]',
  },
  ok: {
    text: 'text-[#34D399]',
    border: 'border-[#34D399]/30',
    dot: 'bg-[#34D399]',
    glow: 'shadow-[0_0_8px_rgba(52,211,153,0.4)]',
  },
  warn: {
    text: 'text-[#F5B544]',
    border: 'border-[#F5B544]/30',
    dot: 'bg-[#F5B544]',
    glow: 'shadow-[0_0_8px_rgba(245,181,68,0.4)]',
  },
  danger: {
    text: 'text-[#F87171]',
    border: 'border-[#F87171]/30',
    dot: 'bg-[#F87171]',
    glow: 'shadow-[0_0_8px_rgba(248,113,113,0.4)]',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}) => {
  const current = toneStyles[tone] || toneStyles.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs border bg-[#0A0A0A] font-mono text-[10px] tracking-[0.12em] uppercase select-none',
        current.border,
        current.text,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', current.dot, current.glow)}
        />
      )}
      <span>{children}</span>
    </span>
  );
};

export default Badge;

