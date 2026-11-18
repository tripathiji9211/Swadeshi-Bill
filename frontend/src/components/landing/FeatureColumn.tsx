import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Sparkline } from '@/components/ui/Sparkline';
import { useMotionMode } from '@/hooks/useMotionMode';

export interface FeatureColumnItem {
  id: string;
  title: string;
  specs: string;
  description: string;
  status: string;
  sparklineData?: number[];
  color?: 'cyan' | 'periwinkle' | 'ok' | 'warn';
}

export interface FeatureColumnProps {
  items: FeatureColumnItem[];
  className?: string;
}

export const FeatureColumn: React.FC<FeatureColumnProps> = ({ items, className }) => {
  const { t } = useTranslation();
  const { reduceMotion } = useMotionMode();

  return (
    <section className={cn('py-16 md:py-20 border-t border-[#1C1C1F] relative', className)}>
      {/* Top Connector Line with Pulsing Nodes */}
      <div className="relative mb-12 hidden md:block">
        <div className="h-[1px] w-full bg-[#1C1C1F]" />
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-around">
          {items.map((_, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0A0A0A] border border-[#FF9933] flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-[#FF9933]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Columns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="bg-[#0A0A0A] border border-[#1C1C1F] rounded p-5 flex flex-col justify-between hover:border-[#2A2A2E] transition-colors relative"
          >
            <div>
              {/* Header Status Tag */}
              <div className="flex items-center justify-between mb-3 border-b border-[#1C1C1F] pb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#52555C]">
                  {item.id}
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#34D399] px-1.5 py-0.5 rounded-xs border border-[#34D399]/30 bg-[#111111]">
                  {item.status}
                </span>
              </div>

              {/* Title & Specs */}
              <h3 className="text-base font-normal text-[#EDEDED] mb-1 tracking-tight">
                {item.title}
              </h3>
              <div className="font-mono text-[11px] text-[#FF9933] mb-2.5">
                {item.specs}
              </div>

              <p className="text-xs text-[#8A8F98] leading-relaxed mb-4">
                {item.description}
              </p>
            </div>

            {/* Sparkline Indicator / Bottom Activity */}
            <div className="pt-3 border-t border-[#1C1C1F]/60 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#52555C] tracking-wide uppercase">
                {t('landing.telemetryTitle', 'Telemetry')}
              </span>
              <div className="w-20">
                <Sparkline
                  data={item.sparklineData || [12, 18, 14, 22, 19, 28, 24]}
                  color={item.color || 'cyan'}
                  height={18}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default FeatureColumn;
