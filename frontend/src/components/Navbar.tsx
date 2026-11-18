import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBackendStatus } from '@/api/client';
import { useReviewQueue } from '@/hooks/useExpenses';
import { SoundToggle } from './SoundToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UserMenu } from './UserMenu';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { isOnline } = useBackendStatus();
  const { data: reviewItems } = useReviewQueue();
  const pendingReviewCount = reviewItems?.length || 0;

  const navLinks = [
    { to: '/upload', label: t('nav.upload', 'Upload') },
    { to: '/review-queue', label: t('nav.review', 'Review'), badge: pendingReviewCount },
    { to: '/dashboard', label: t('nav.dashboard', 'Dashboard') },
    { to: '/forecast', label: t('nav.forecast', 'Forecast') },
    { to: '/insights', label: t('nav.insights', 'Insights') },
    { to: '/ask', label: t('nav.ask', 'Sahayak') },
    { to: '/about', label: t('nav.about', 'About') },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 h-16 w-full border-b border-[#1C1C1F] bg-[#000000]/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* LEFT: Khata Book + 24-spoke Chakra Motif Logo */}
        <div className="flex items-center gap-3">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            {/* Outlined rounded-square Ledger + Chakra mark */}
            <div className="w-8 h-8 rounded border border-[#FF9933]/50 bg-[#0A0A0A] flex items-center justify-center font-heading text-xs font-bold text-[#FF9933] group-hover:border-[#FF9933] group-hover:shadow-[0_0_10px_rgba(255,153,51,0.3)] transition-all">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#FF9933]" fill="none" stroke="currentColor" strokeWidth="1.8">
                {/* Ledger Book */}
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                {/* 24-Spoke Central Wheel Motif */}
                <circle cx="12" cy="11" r="4.5" stroke="#D4A017" strokeWidth="1.2" />
                <circle cx="12" cy="11" r="1.2" fill="#D4A017" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-heading font-medium tracking-tight text-[#F5EFE6] leading-none group-hover:text-white transition-colors">
                {t('brand.name', 'Swadeshi Khata')}
              </span>
              <span className="text-[10px] font-mono tracking-wider text-[#A59E92] uppercase leading-tight mt-0.5">
                {t('brand.tagline', 'Aapka hisaab, aapka bharosa')}
              </span>
            </div>
          </NavLink>
        </div>

        {/* CENTER: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link) => {
            const isActive =
              location.pathname === link.to ||
              (link.to !== '/' && location.pathname.startsWith(link.to));

            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`relative text-xs tracking-tight transition-colors py-1 ${
                  isActive
                    ? 'text-[#FF9933] font-medium'
                    : 'text-[#A59E92] hover:text-[#F5EFE6]'
                }`}
              >
                <span>{link.label}</span>

                {Boolean(link.badge) && link.badge! > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] bg-[#B3202A] text-white">
                    {link.badge}
                  </span>
                )}

                {isActive && (
                  <span className="absolute bottom-[-18px] left-0 right-0 h-[1.5px] bg-[#FF9933] shadow-[0_0_8px_rgba(255,153,51,0.6)]" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* RIGHT: Status Dot, Sound, Language, Search, User Menu, CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Shortcut Ctrl+K */}
          <button
            type="button"
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
              window.dispatchEvent(event);
            }}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-[10.5px] font-mono text-[#A59E92] transition-colors"
            title={t('palette.footerShortcut', 'Command Palette')}
          >
            <Search className="w-3 h-3 text-[#FF9933]" />
            <span className="hidden md:inline">Ctrl+K</span>
          </button>

          {/* Sound Toggle */}
          <SoundToggle className="hidden sm:inline-flex" />

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Backend Status Dot */}
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#0A0A0A] border border-[#1C1C1F] text-[10px] font-mono text-[#A59E92] select-none">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline
                  ? 'bg-[#138808] shadow-[0_0_6px_rgba(19,136,8,0.7)]'
                  : 'bg-[#B3202A] shadow-[0_0_6px_rgba(179,32,42,0.7)]'
              }`}
            />
            <span>{isOnline ? t('common.online', 'Online') : t('common.offline', 'Offline')}</span>
          </div>

          {/* User Profile / Menu */}
          <UserMenu />

          {/* Primary CTA Button (Upload) */}
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#F5EFE6] hover:bg-white text-black font-medium text-xs tracking-tight transition-colors cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.15)]"
          >
            <span>{t('nav.upload', 'Upload')}</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded text-[#A59E92] hover:text-[#F5EFE6] hover:bg-[#111111] transition-colors"
            aria-label="Toggle mobile navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* FULLSCREEN MOBILE OVERLAY MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#000000] pt-20 px-6 pb-24 overflow-y-auto lg:hidden flex flex-col justify-between animate-in fade-in duration-200">
          <div className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#656057] mb-2">
              {t('nav.menuTitle', 'Navigation')}
            </div>

            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between py-3 border-b border-[#1C1C1F] text-base font-body tracking-tight transition-colors ${
                    isActive ? 'text-[#FF9933] font-medium' : 'text-[#F5EFE6]'
                  }`
                }
              >
                <span>{link.label}</span>
                {Boolean(link.badge) && link.badge! > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-mono text-xs bg-[#B3202A] text-white">
                    {link.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="pt-6 border-t border-[#1C1C1F] space-y-4">
            <div className="flex items-center justify-between">
              <SoundToggle />
              <div className="flex items-center gap-2 text-xs font-mono text-[#A59E92]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-[#138808]' : 'bg-[#B3202A]'
                  }`}
                />
                <span>{t('landing.systemStatus', 'System Status')}: {isOnline ? t('common.online', 'Online') : t('common.offline', 'Offline')}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/upload');
              }}
              className="w-full py-3 rounded bg-[#FF9933] text-black font-medium text-xs font-mono uppercase tracking-wider"
            >
              {t('nav.uploadCta', 'Upload Receipt')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
