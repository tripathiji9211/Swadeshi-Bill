import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionMode } from '@/hooks/useMotionMode';

export interface FeatureSplitProps {
  tag: string; // e.g. "// SECTION 01: AUDIT_PIPELINE"
  title: string;
  subtitle?: string;
  description: string;
  bulletPoints?: string[];
  reverse?: boolean; // If true: visual on left, text on right
  visualSlot: React.ReactNode;
  className?: string;
}

export const FeatureSplit: React.FC<FeatureSplitProps> = ({
  tag,
  title,
  subtitle,
  description,
  bulletPoints,
  reverse = false,
  visualSlot,
  className,
}) => {
  const { reduceMotion } = useMotionMode();

  return (
    <section
      className={cn(
        'relative py-16 md:py-24 border-t border-[#1C1C1F] overflow-hidden',
        className
      )}
    >
      {/* Subtle corner crosshairs */}
      <span className="absolute top-0 left-0 font-mono text-[10px] text-[#52555C] select-none pointer-events-none">
        +
      </span>
      <span className="absolute top-0 right-0 font-mono text-[10px] text-[#52555C] select-none pointer-events-none">
        +
      </span>

      <div
        className={cn(
          'grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center',
          reverse && 'lg:grid-flow-dense'
        )}
      >
        {/* Text Block */}
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className={cn(
            'lg:col-span-5 flex flex-col justify-center',
            reverse ? 'lg:col-start-8' : 'lg:col-start-1'
          )}
        >
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#52555C] mb-3">
            {tag}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-4xl text-[#EDEDED] font-normal tracking-tight leading-[1.1] mb-4">
            {title}
          </h2>
          {subtitle && (
            <div className="text-base text-[#FF9933] font-medium mb-3">
              {subtitle}
            </div>
          )}
          <p className="text-sm text-[#8A8F98] leading-relaxed mb-6">
            {description}
          </p>

          {bulletPoints && bulletPoints.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-[#1C1C1F]">
              {bulletPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-[#8A8F98]">
                  <span className="font-mono text-[#FF9933] mt-0.5 select-none">›</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Visual Card / Interactive Panel Slot */}
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={cn(
            'lg:col-span-7',
            reverse ? 'lg:col-start-1' : 'lg:col-start-6'
          )}
        >
          {visualSlot}
        </motion.div>
      </div>
    </section>
  );
};

export default FeatureSplit;

