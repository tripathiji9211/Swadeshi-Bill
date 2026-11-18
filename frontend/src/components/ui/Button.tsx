import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  mono?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      mono = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] rounded';

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-xs gap-2',
      lg: 'h-11 px-5 text-sm gap-2.5',
    };

    const variantStyles: Record<ButtonVariant, string> = {
      // Solid white button with black text (primary CTA in reference)
      primary:
        'bg-[#EDEDED] hover:bg-[#FFFFFF] text-[#000000] font-semibold border border-[#FFFFFF] shadow-sm',
      // Dark #111 secondary with subtle 1px border
      secondary:
        'bg-[#111111] hover:bg-[#161618] text-[#EDEDED] border border-[#2A2A2E] hover:border-[#38383D]',
      // Outlined ghost button
      ghost:
        'bg-transparent hover:bg-[#111111] text-[#8A8F98] hover:text-[#EDEDED] border border-[#1C1C1F] hover:border-[#2A2A2E]',
      // Danger action
      danger:
        'bg-[#1A0C0C] hover:bg-[#251010] text-[#F87171] border border-[#3D1A1A]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          mono && 'font-mono uppercase tracking-[0.12em] text-[10px]',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;

