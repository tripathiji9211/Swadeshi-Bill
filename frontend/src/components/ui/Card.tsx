import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export type CardVariant = 'glass' | 'solid' | 'neon' | 'interactive';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  glow?: boolean;
  accentBar?: boolean;
  className?: string;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  // Command Dashboard Panel: neutral #0A0A0A, 1px border #1C1C1F
  glass:
    'bg-[#0A0A0A] border border-[#1C1C1F] hover:border-[#2A2A2E] transition-colors duration-150',
  solid:
    'bg-[#0A0A0A] border border-[#1C1C1F]',
  neon:
    'bg-[#0A0A0A] border border-[#FF9933]/30 hover:border-[#FF9933]/60 transition-colors duration-150',
  interactive:
    'bg-[#0A0A0A] border border-[#1C1C1F] hover:bg-[#111111] hover:border-[#2A2A2E] cursor-pointer transition-colors duration-150 active:scale-[0.99]',
};

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
  xl: 'p-7 sm:p-9',
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'glass',
  padding = 'md',
  glow = false,
  accentBar = false,
  className,
  headerSlot,
  footerSlot,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'relative rounded overflow-hidden text-[#EDEDED]',
        variantStyles[variant],
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {/* Optional top 1px accent line (cyan or periwinkle, no blur/gradient spread) */}
      {(glow || accentBar) && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-[#FF9933]/40" />
      )}

      {/* Header Slot */}
      {headerSlot && (
        <div className="mb-4 pb-2.5 border-b border-[#1C1C1F] flex items-center justify-between text-xs">
          {headerSlot}
        </div>
      )}

      {/* Body content */}
      {children}

      {/* Footer Slot */}
      {footerSlot && (
        <div className="mt-4 pt-2.5 border-t border-[#1C1C1F] flex items-center justify-between text-xs text-[#8A8F98]">
          {footerSlot}
        </div>
      )}
    </motion.div>
  );
};

export default Card;
