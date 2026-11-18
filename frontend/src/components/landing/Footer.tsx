import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackendStatus } from '@/api/client';
import { cn } from '@/lib/utils';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const { isOnline } = useBackendStatus();

  const columns = [
    {
      title: t('nav.menuTitle', 'Product'),
      links: [
        { label: t('nav.upload', 'Upload'), to: '/upload' },
        { label: t('nav.review', 'Review Queue'), to: '/review-queue' },
        { label: t('nav.dashboard', 'Mission Control'), to: '/dashboard' },
        { label: t('nav.forecast', 'Spend Forecast'), to: '/forecast' },
        { label: t('nav.insights', 'Savings Insights'), to: '/insights' },
        { label: t('nav.ask', 'Sahayak'), to: '/ask' },
      ],
    },
    {
      title: t('about.tag', 'Technology'),
      links: [
        { label: 'EasyOCR (EN + HI)', to: '/about' },
        { label: 'OpenCV Preprocessing', to: '/about' },
        { label: 'Isolation Forest Anomaly', to: '/dashboard' },
        { label: t('landing.capability2Title', 'Anomaly Detection'), to: '/review-queue' },
        { label: 'FastAPI REST Endpoints', href: 'http://127.0.0.1:8000/docs', external: true },
      ],
    },
    {
      title: t('brand.name', 'Swadeshi Khata'),
      links: [
        { label: t('nav.about', 'About'), to: '/about' },
        { label: t('brand.tagline', 'Aapka hisaab, aapka bharosa'), to: '/' },
        { label: t('brand.taglineSub', 'Indian SMB Sovereignty'), to: '/about' },
        { label: 'GSTIN / ITC Engine', to: '/dashboard' },
      ],
    },
    {
      title: t('landing.howItWorksTag', 'Resources'),
      links: [
        { label: 'Swagger API Docs', href: 'http://127.0.0.1:8000/docs', external: true },
        { label: 'OpenAPI Schema', href: 'http://127.0.0.1:8000/openapi.json', external: true },
        { label: t('upload.orPickSample', 'Sample Indian Bills'), to: '/upload' },
        { label: t('dashboard.fyHorizon', 'Financial Year Helper'), to: '/dashboard' },
      ],
    },
    {
      title: t('landing.signalSummary', 'System Status'),
      links: [
        { label: 'FastAPI Health Check', href: 'http://127.0.0.1:8000/health', external: true },
        { label: 'SQLite Local Ledger', to: '/dashboard' },
        { label: t('landing.viewDocs', 'System Guide'), to: '/about' },
      ],
    },
    {
      title: t('auth.termsAgree', 'Data Sovereignty'),
      links: [
        { label: t('landing.ctaFooter', 'Data Privacy & Local Retraining'), to: '/about' },
        { label: t('dashboard.gstEstimateNotice', 'GST Disclaimer'), to: '/dashboard' },
      ],
    },
  ];

  return (
    <footer className="w-full border-t border-[#1C1C1F] bg-[#000000] py-12 sm:py-16 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 6 Column Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {columns.map((col, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#656057]">
                {col.title}
              </h3>
              <ul className="space-y-2 text-xs">
                {col.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#A59E92] hover:text-[#F5EFE6] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to!}
                        className="text-[#A59E92] hover:text-[#F5EFE6] transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Row */}
        <div className="pt-8 border-t border-[#1C1C1F] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          {/* Logo + Copyright */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded border border-[#FF9933]/40 bg-[#0A0A0A] flex items-center justify-center font-heading text-xs text-[#FF9933]">
              SK
            </div>
            <span className="font-mono text-[11px] text-[#A59E92]">
              &copy; 2026 {t('brand.name', 'Swadeshi Khata')} &bull; {t('brand.tagline', 'Aapka hisaab, aapka bharosa')}
            </span>
          </div>

          {/* Right-Aligned Backend System Status */}
          <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.12em] uppercase">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isOnline ? 'bg-[#138808] shadow-[0_0_8px_rgba(19,136,8,0.7)]' : 'bg-[#B3202A]'
              )}
            />
            <span className={isOnline ? 'text-[#F5EFE6]' : 'text-[#B3202A]'}>
              {t('landing.systemStatus', 'System Status')}: {isOnline ? t('common.online', 'ONLINE') : t('common.offline', 'OFFLINE')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
