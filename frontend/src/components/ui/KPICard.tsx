import React from 'react';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export interface KPITrend {
  value: string | number;
  direction?: 'up' | 'down' | 'neutral';
  isPositiveGood?: boolean;
  label?: string;
}

export interface KPICardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: KPITrend;
  tooltip?: string;
  valueColor?: string;
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'default';
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  sub,
  icon,
  trend,
  tooltip,
  valueColor = 'text-[#EDEDED]',
  accent = 'brand',
  isLoading = false,
  className,
  onClick,
}) => {
  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded bg-[#0A0A0A] border border-[#1C1C1F] p-4 space-y-3',
          className
        )}
      >
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
    );
  }

  // Trend tag rendering
  const renderTrendBadge = () => {
    if (!trend) return null;
    const dir = trend.direction || 'neutral';
    const isGood =
      trend.isPositiveGood !== undefined
        ? dir === 'up'
          ? trend.isPositiveGood
          : !trend.isPositiveGood
        : dir === 'up';

    let colorClass = 'text-[#8A8F98] border-[#1C1C1F]';
    let IconComp = Minus;

    if (dir === 'up') {
      colorClass = isGood ? 'text-[#34D399] border-[#34D399]/30' : 'text-[#F87171] border-[#F87171]/30';
      IconComp = TrendingUp;
    } else if (dir === 'down') {
      colorClass = isGood ? 'text-[#34D399] border-[#34D399]/30' : 'text-[#F87171] border-[#F87171]/30';
      IconComp = TrendingDown;
    }

    return (
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-mono text-[10px] tracking-[0.08em] uppercase border bg-[#111111]',
            colorClass
          )}
        >
          <IconComp className="w-2.5 h-2.5" />
          <span>{trend.value}</span>
        </span>
        {trend.label && (
          <span className="text-[10px] font-mono text-[#52555C] tracking-[0.05em]">
            {trend.label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded bg-[#0A0A0A] border border-[#1C1C1F] p-4 flex flex-col justify-between transition-colors duration-150',
        onClick ? 'cursor-pointer hover:bg-[#111111] hover:border-[#2A2A2E]' : 'hover:border-[#2A2A2E]',
        className
      )}
    >
      {/* Top Row: Mono Label + Optional Icon/Trend */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#52555C] truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {renderTrendBadge()}
          {icon && (
            <span className="text-[#8A8F98] text-xs opacity-80">{icon}</span>
          )}
        </div>
      </div>

      {/* Main KPI Value */}
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div
          className={cn(
            'text-[28px] sm:text-[30px] font-mono tabular-nums font-normal tracking-tight leading-none text-[#EDEDED]',
            valueColor.includes('text-') ? valueColor : 'text-[#EDEDED]'
          )}
        >
          {value}
        </div>
      </div>

      {/* Bottom Subtext / Tooltip */}
      {(sub || tooltip) && (
        <div className="mt-2.5 pt-2 border-t border-[#1C1C1F]/60 flex items-center justify-between gap-2 text-[11px] text-[#8A8F98]">
          <span className="truncate">{sub || tooltip}</span>
          {tooltip && sub && (
            <span title={tooltip} className="cursor-help text-[#52555C] hover:text-[#8A8F98]">
              <Info className="w-3 h-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default KPICard;
