import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/i18n';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLang = (code: SupportedLanguageCode) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111111] hover:bg-[#161618] border border-[#1C1C1F] text-xs font-mono text-[#F5EFE6] transition-colors cursor-pointer"
        aria-label="Language Switcher"
      >
        <Globe className="w-3.5 h-3.5 text-[#FF9933]" />
        <span className="font-medium">{currentLang.native}</span>
        <ChevronDown className="w-3 h-3 text-[#A59E92]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded bg-[#0A0A0A] border border-[#1C1C1F] py-1 shadow-2xl z-50">
          <div className="px-3 py-1 text-[10px] font-mono text-[#656057] uppercase tracking-wider border-b border-[#1C1C1F]">
            {t('common.selectLanguage', 'Select Language')}
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => changeLang(lang.code as SupportedLanguageCode)}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#161618] transition-colors cursor-pointer ${
                i18n.language === lang.code ? 'text-[#FF9933] font-medium bg-[#111111]' : 'text-[#A59E92]'
              }`}
            >
              <span>{lang.native}</span>
              <span className="font-mono text-[10px] text-[#656057]">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
