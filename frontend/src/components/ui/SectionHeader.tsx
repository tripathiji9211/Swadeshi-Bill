import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tag?: string; // Optional mono breadcrumb e.g. "// TELEMETRY_OVERVIEW"
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  tag,
  icon,
  badge,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#1C1C1F] mb-6',
        className
      )}
    >
      <div className="space-y-1">
        {tag && (
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#52555C]">
            {tag}
          </div>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && (
            <div className="w-7 h-7 rounded border border-[#1C1C1F] bg-[#111111] flex items-center justify-center text-[#FF9933]">
              {icon}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[#EDEDED]">
            {title}
          </h1>
          {badge && <div className="ml-1">{badge}</div>}
        </div>

        {subtitle && (
          <p className="text-xs sm:text-sm text-[#8A8F98] max-w-3xl leading-relaxed">{subtitle}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2.5 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
};

export default SectionHeader;
