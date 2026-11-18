import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ArrowRight, Check, X, ShieldCheck, Upload, LayoutDashboard } from 'lucide-react';

export const OnboardingTour: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('swadeshi_tour_completed');
      if (!completed) {
        setIsOpen(true);
      }
    }
  }, []);

  if (!isOpen) return null;

  const closeTour = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('swadeshi_tour_completed', 'true');
    }
  };

  const steps = [
    {
      num: 1,
      title: t('tour.step1Title', 'Welcome to Swadeshi Khata'),
      subtitle: t('tour.step1Subtitle', 'Your Sovereign AI Financial Sentinel & Forensic Khata Ledger'),
      description: t('tour.step1Desc', 'Easily digitize thermal slips, handwritten invoices, and GST bills with calibrated machine learning confidence.'),
      icon: Sparkles,
      color: '#FF9933',
    },
    {
      num: 2,
      title: t('tour.step2Title', 'Bilingual OCR & Entity Extraction'),
      subtitle: t('tour.step2Subtitle', 'EasyOCR (EN+HI) with OpenCV preprocessing'),
      description: t('tour.step2Desc', 'Drop or snap any bill. OpenCV deskews the image and our parser extracts vendor, date, line items, and taxes.'),
      icon: Upload,
      color: '#D4A017',
    },
    {
      num: 3,
      title: t('tour.step3Title', 'Review Queue & Active Learning'),
      subtitle: t('tour.step3Subtitle', 'Human-in-the-loop retraining on merchant corrections'),
      description: t('tour.step3Desc', 'Low-confidence receipts route to your Review Queue. Your edits instantly train the local classifier with zero cloud leakage.'),
      icon: ShieldCheck,
      color: '#138808',
    },
    {
      num: 4,
      title: t('tour.step4Title', 'Mission Control & Anomaly Sentinel'),
      subtitle: t('tour.step4Subtitle', 'Isolation Forest anomaly detection & forward burn forecast'),
      description: t('tour.step4Desc', 'Track live spend telemetry, catch billing discrepancies, and plan ahead with festival-aware forecasts.'),
      icon: LayoutDashboard,
      color: '#FF9933',
    },
  ];

  const current = steps[step - 1];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-md bg-[#0A0A0A] border border-[#1C1C1F] p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={closeTour}
          className="absolute top-4 right-4 text-[#656057] hover:text-[#F5EFE6] cursor-pointer"
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 mb-5">
          {steps.map((s) => (
            <div
              key={s.num}
              className={`h-1 rounded-full transition-all duration-300 ${
                s.num === step
                  ? 'w-8 bg-[#FF9933]'
                  : s.num < step
                    ? 'w-4 bg-[#138808]'
                    : 'w-4 bg-[#1C1C1F]'
              }`}
            />
          ))}
          <span className="ml-auto font-mono text-[10px] text-[#A59E92] uppercase">
            {step} / 4
          </span>
        </div>

        {/* Step Icon */}
        <div
          className="w-12 h-12 rounded-full border border-[#1C1C1F] bg-[#111111] flex items-center justify-center mb-4"
          style={{ color: current.color }}
        >
          <Icon className="w-6 h-6" />
        </div>

        {/* Content */}
        <h2 className="text-lg font-heading font-medium text-[#F5EFE6] tracking-tight">
          {current.title}
        </h2>
        <div className="text-xs font-mono text-[#D4A017] mt-0.5">{current.subtitle}</div>
        <p className="text-xs text-[#A59E92] mt-3 leading-relaxed font-body">
          {current.description}
        </p>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#1C1C1F]">
          <button
            type="button"
            onClick={closeTour}
            className="text-xs font-mono text-[#656057] hover:text-[#A59E92] cursor-pointer"
          >
            {t('tour.skip', 'Skip tour')}
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#A59E92] cursor-pointer"
              >
                {t('tour.previous', 'Previous')}
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 rounded bg-[#FF9933] hover:bg-[#E07D1E] text-black font-medium text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>{t('tour.next', 'Next')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={closeTour}
                className="px-4 py-1.5 rounded bg-[#138808] hover:bg-[#0E6806] text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>{t('tour.getStarted', 'Get Started')}</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
