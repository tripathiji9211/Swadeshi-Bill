import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useMotionMode } from '@/hooks/useMotionMode';

export interface TestimonialItem {
  id: string;
  variant: 'mint' | 'lime';
  quote: string;
  source: string;
  metric: string;
}

export interface TestimonialSectionProps {
  testimonials: TestimonialItem[];
  className?: string;
}

export const TestimonialCard: React.FC<TestimonialSectionProps> = ({
  testimonials,
  className,
}) => {
  const { t } = useTranslation();
  const { reduceMotion } = useMotionMode();

  return (
    <section className={cn('py-16 md:py-20 border-t border-[#1C1C1F]', className)}>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#FF9933] mb-3">
        {t('landing.testimonialsTag', 'Merchant Feedback')}
      </div>
      <h2 className="text-3xl sm:text-4xl text-[#EDEDED] font-normal tracking-tight mb-8">
        {t('landing.testimonialsTitle', 'Trusted by Indian business owners')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testimonials.map((item, index) => {
          const isMint = item.variant === 'mint';

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className={cn(
                'rounded p-8 flex flex-col justify-between text-black relative select-none',
                isMint ? 'bg-[#CFE9E4]' : 'bg-[#C6FF3D]'
              )}
            >
              {/* Header mono tag */}
              <div className="flex items-center justify-between pb-4 border-b border-black/10 mb-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold opacity-75">
                  {item.id}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold opacity-75">
                  {t('common.verified', 'Verified')}
                </span>
              </div>

              {/* Quote */}
              <div className="text-2xl sm:text-3xl font-normal tracking-tight leading-snug mb-8 text-black">
                "{item.quote}"
              </div>

              {/* Bottom metadata */}
              <div className="pt-4 border-t border-black/10 flex items-center justify-between text-xs">
                <div className="font-mono font-medium opacity-85">
                  {item.source}
                </div>
                <div className="font-mono font-bold tracking-tight text-right">
                  {item.metric}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default TestimonialCard;
