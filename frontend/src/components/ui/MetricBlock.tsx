import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';

export interface MetricBlockProps {
  label: string;
  value: React.ReactNode;
  unitTag?: string; // e.g. "INR", "ACTV", "100%", "LOW"
  sub?: string;
  sparklineData?: number[];
  sparklineColor?: string; // default cyan '#FF9933'
  className?: string;
}

export const MetricBlock: React.FC<MetricBlockProps> = ({
  label,
  value,
  unitTag,
  sub,
  sparklineData,
  sparklineColor = '#FF9933',
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-[#0A0A0A] border border-[#1C1C1F] rounded p-4 flex flex-col justify-between transition-colors hover:border-[#2A2A2E]',
        className
      )}
    >
      {/* Header: Mono Label + Unit Tag */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#52555C]">
          {label}
        </span>
        {unitTag && (
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[#8A8F98] px-1.5 py-0.5 rounded-xs border border-[#1C1C1F] bg-[#111111]">
            {unitTag}
          </span>
        )}
      </div>

      {/* Main KPI Value + Sparkline */}
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-[28px] sm:text-[32px] font-mono tabular-nums font-normal text-[#EDEDED] tracking-tight leading-none">
          {value}
        </div>
        {sparklineData && (
          <Sparkline
            data={sparklineData}
            color={sparklineColor}
            width={72}
            height={22}
          />
        )}
      </div>

      {/* Subtext */}
      {sub && (
        <div className="text-[11px] text-[#8A8F98] mt-2 truncate">
          {sub}
        </div>
      )}
    </div>
  );
};

export default MetricBlock;

