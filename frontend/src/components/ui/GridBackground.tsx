import React from 'react';
import { cn } from '@/lib/utils';

export interface GridBackgroundProps {
  children?: React.ReactNode;
  variant?: 'grid' | 'dots';
  className?: string;
  showCrosshairs?: boolean;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({
  children,
  variant = 'grid',
  className,
  showCrosshairs = false,
}) => {
  return (
    <div
      className={cn(
        'relative w-full',
        variant === 'grid' ? 'bg-grid-tech' : 'bg-dots-tech',
        className
      )}
    >
      {showCrosshairs && (
        <>
          <span className="absolute -top-2 -left-2 font-mono text-[11px] text-[#52555C] pointer-events-none select-none">
            +
          </span>
          <span className="absolute -top-2 -right-2 font-mono text-[11px] text-[#52555C] pointer-events-none select-none">
            +
          </span>
          <span className="absolute -bottom-2 -left-2 font-mono text-[11px] text-[#52555C] pointer-events-none select-none">
            +
          </span>
          <span className="absolute -bottom-2 -right-2 font-mono text-[11px] text-[#52555C] pointer-events-none select-none">
            +
          </span>
        </>
      )}
      {children}
    </div>
  );
};

export default GridBackground;

