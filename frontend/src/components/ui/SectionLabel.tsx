import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionLabelProps {
  label: string;
  tag?: string;
  className?: string;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({
  label,
  tag,
  className,
}) => {
  return (
    <div
      className={cn(
        'font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#52555C] flex items-center gap-2 select-none',
        className
      )}
    >
      <span className="w-1.5 h-1.5 bg-[#52555C] rounded-full shrink-0" />
      <span>{label}</span>
      {tag && (
        <span className="text-[#8A8F98]">
          // {tag}
        </span>
      )}
    </div>
  );
};

export default SectionLabel;

