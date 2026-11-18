import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type BadgeVariant =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  brand: {
    container: 'bg-[#111111] text-[#FF9933] border-[#FF9933]/30',
    dot: 'bg-[#FF9933]',
  },
  success: {
    container: 'bg-[#111111] text-[#34D399] border-[#34D399]/30',
    dot: 'bg-[#34D399]',
  },
  warning: {
    container: 'bg-[#111111] text-[#F5B544] border-[#F5B544]/30',
    dot: 'bg-[#F5B544]',
  },
  danger: {
    container: 'bg-[#111111] text-[#F87171] border-[#F87171]/30',
    dot: 'bg-[#F87171]',
  },
  info: {
    container: 'bg-[#111111] text-[#8B8DFF] border-[#8B8DFF]/30',
    dot: 'bg-[#8B8DFF]',
  },
  neutral: {
    container: 'bg-[#111111] text-[#8A8F98] border-[#1C1C1F]',
    dot: 'bg-[#52555C]',
  },
  purple: {
    container: 'bg-[#111111] text-[#8B8DFF] border-[#8B8DFF]/30',
    dot: 'bg-[#8B8DFF]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[9.5px] gap-1 font-mono uppercase tracking-[0.08em]',
  md: 'px-2 py-0.5 text-[10.5px] gap-1.5 font-mono uppercase tracking-[0.08em]',
  lg: 'px-2.5 py-1 text-xs gap-2 font-mono uppercase tracking-[0.1em]',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'brand',
  size = 'md',
  icon,
  dot = false,
  pulse = false,
  className,
}) => {
  const v = variantStyles[variant] || variantStyles.brand;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs font-mono font-medium border whitespace-nowrap',
        sizeStyles[size],
        v.container,
        className
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', v.dot, pulse && 'animate-pulse')}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};

// ============================================================================
// DOMAIN-SPECIFIC FINTECH AUDIT BADGES
// ============================================================================

/**
 * Anomaly Risk Severity Badge (LOW / MEDIUM / HIGH)
 */
export const AnomalyRiskBadge: React.FC<{
  severity?: string;
  score?: number;
  size?: BadgeSize;
}> = ({ severity = 'LOW', score, size = 'md' }) => {
  const { t } = useTranslation();
  const sev = (severity || 'LOW').toUpperCase();

  if (sev === 'HIGH') {
    const text = t('common.highRisk', 'High Risk');
    return (
      <StatusBadge
        label={score !== undefined ? `${text} (${(score * 100).toFixed(0)}%)` : text}
        variant="danger"
        size={size}
        icon={<AlertOctagon className="w-3 h-3" />}
        dot
        pulse
      />
    );
  }

  if (sev === 'MEDIUM') {
    const text = t('common.moderateRisk', 'Moderate Risk');
    return (
      <StatusBadge
        label={score !== undefined ? `${text} (${(score * 100).toFixed(0)}%)` : text}
        variant="warning"
        size={size}
        icon={<AlertTriangle className="w-3 h-3" />}
        dot
      />
    );
  }

  return (
    <StatusBadge
      label={t('common.auditPassed', 'Audit Passed')}
      variant="success"
      size={size}
      icon={<ShieldCheck className="w-3 h-3" />}
    />
  );
};

/**
 * Review Queue Status Badge
 */
export const ReviewStatusBadge: React.FC<{
  needsReview: boolean;
  reason?: string;
  size?: BadgeSize;
}> = ({ needsReview, reason, size = 'md' }) => {
  const { t } = useTranslation();

  if (needsReview) {
    return (
      <StatusBadge
        label={reason || t('common.needsReview', 'Needs Review')}
        variant="warning"
        size={size}
        icon={<Clock className="w-3 h-3" />}
        dot
        pulse
      />
    );
  }

  return (
    <StatusBadge
      label={t('common.verified', 'Verified')}
      variant="success"
      size={size}
      icon={<CheckCircle2 className="w-3 h-3" />}
    />
  );
};

/**
 * Confidence Score Badge
 */
export const ConfidenceBadge: React.FC<{
  confidence: number;
  labelPrefix?: string;
  size?: BadgeSize;
}> = ({ confidence, labelPrefix = '', size = 'md' }) => {
  const pct = Math.round(confidence <= 1 ? confidence * 100 : confidence);
  const variant: BadgeVariant = pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'danger';
  const text = `${labelPrefix}${pct}%`;

  return <StatusBadge label={text} variant={variant} size={size} dot />;
};

export default StatusBadge;
