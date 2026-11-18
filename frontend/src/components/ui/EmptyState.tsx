import React from 'react';
import { cn } from '@/lib/utils';
import { FolderSearch, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';

export type EmptyStateVariant = 'default' | 'search' | 'error' | 'success';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  variant?: EmptyStateVariant;
  compact?: boolean;
  className?: string;
}

const defaultIcons: Record<EmptyStateVariant, React.ReactNode> = {
  default: <Inbox className="w-6 h-6 text-[#8A8F98]" />,
  search: <FolderSearch className="w-6 h-6 text-[#FF9933]" />,
  error: <AlertTriangle className="w-6 h-6 text-[#F87171]" />,
  success: <CheckCircle2 className="w-6 h-6 text-[#34D399]" />,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  compact = false,
  className,
}) => {
  const displayIcon = icon !== undefined ? icon : defaultIcons[variant];

  return (
    <div
      className={cn(
        'rounded bg-[#0A0A0A] border border-[#1C1C1F] text-center flex flex-col items-center justify-center',
        compact ? 'p-6 sm:p-8' : 'p-10 sm:p-14',
        className
      )}
    >
      {/* Icon Capsule */}
      {displayIcon && (
        <div className="w-12 h-12 rounded border border-[#1C1C1F] bg-[#111111] flex items-center justify-center mb-4">
          {displayIcon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-base font-normal text-[#EDEDED] tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-1 text-xs text-[#8A8F98] max-w-md leading-relaxed">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
