import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useMotionMode } from '@/hooks/useMotionMode';

export const CTASection: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { reduceMotion } = useMotionMode();

  return (
    <section className="py-24 sm:py-32 border-t border-[#1C1C1F] relative overflow-hidden text-center">
      {/* Corner crosshairs */}
      <span className="absolute top-4 left-4 font-mono text-[10px] text-[#52555C] select-none pointer-events-none">
        +
      </span>
      <span className="absolute top-4 right-4 font-mono text-[10px] text-[#52555C] select-none pointer-events-none">
        +
      </span>

      {/* Faint Grid Background */}
      <div className="absolute inset-0 bg-grid-tech opacity-40 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-3xl mx-auto px-4"
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#FF9933] mb-4">
          {t('landing.ctaTag', 'Get Started')}
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl text-[#EDEDED] font-normal tracking-tight leading-[1.05] mb-6">
          {t('landing.ctaTitle1', 'Audit every receipt.')} <br />
          <span className="text-[#8A8F98]">{t('landing.ctaTitle2', 'Spend with complete confidence.')}</span>
        </h2>

        <p className="text-base text-[#8A8F98] max-w-xl mx-auto mb-10 leading-relaxed">
          {t('landing.ctaDesc', 'Zero manual data entry. High-precision Indian OCR, automated double-entry verification, and forensic anomaly flagging directly on your device.')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/upload')}
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium cursor-pointer"
          >
            {t('landing.startTrial', 'Start Free')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/about')}
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium cursor-pointer"
          >
            {t('landing.viewDocs', 'View System Guide')}
          </Button>
        </div>

        <div className="mt-8 font-mono text-[11px] text-[#52555C] tracking-wide uppercase">
          {t('landing.ctaFooter', 'Air-Gapped Ready • Local SQLite Ledger • Private Retraining Loop')}
        </div>
      </motion.div>
    </section>
  );
};

export default CTASection;
