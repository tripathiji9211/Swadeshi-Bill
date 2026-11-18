import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base pulsing skeleton block with neutral command dark grey shimmer (no blue tint)
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[#111111] border border-[#1C1C1F]',
        className
      )}
      {...props}
    />
  );
};

/**
 * Skeleton Loader for KPI cards
 */
export const SkeletonKPICard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'rounded bg-[#0A0A0A] border border-[#1C1C1F] p-4 space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
};

/**
 * Skeleton Loader for standard cards / panels
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'rounded bg-[#0A0A0A] border border-[#1C1C1F] p-5 space-y-4',
        className
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1F]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for data tables
 */
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 5, className }) => {
  return (
    <div
      className={cn(
        'rounded bg-[#0A0A0A] border border-[#1C1C1F] overflow-hidden',
        className
      )}
    >
      {/* Table Header */}
      <div className="bg-[#0A0A0A] px-4 py-3 border-b border-[#1C1C1F] flex items-center justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-[#1C1C1F] p-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-3 py-3 flex items-center justify-between gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-3 w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
