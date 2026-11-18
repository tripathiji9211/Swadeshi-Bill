import React from 'react';
import { cn } from '@/lib/utils';

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  tag?: string;
  actionSlot?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  tag,
  actionSlot,
  padding = 'md',
  className,
  children,
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6 sm:p-8',
  };

  const hasHeader = Boolean(title || tag || actionSlot);

  return (
    <div
      className={cn(
        'bg-[#0A0A0A] border border-[#1C1C1F] rounded text-[#EDEDED] relative overflow-hidden',
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div className="px-5 py-3 border-b border-[#1C1C1F] flex items-center justify-between gap-3 bg-[#0A0A0A]">
          <div className="flex items-center gap-2.5 min-w-0">
            {tag && (
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#52555C] px-1.5 py-0.5 rounded-xs border border-[#1C1C1F] bg-[#111111]">
                {tag}
              </span>
            )}
            {typeof title === 'string' ? (
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#52555C] font-normal truncate">
                {title}
              </div>
            ) : (
              title
            )}
            {subtitle && (
              <span className="text-xs text-[#8A8F98] hidden sm:inline truncate">
                &bull; {subtitle}
              </span>
            )}
          </div>
          {actionSlot && <div className="shrink-0">{actionSlot}</div>}
        </div>
      )}

      <div className={paddingStyles[padding]}>{children}</div>
    </div>
  );
};

export default Panel;
