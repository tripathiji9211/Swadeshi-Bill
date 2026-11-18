import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';
import te from './locales/te.json';
import gu from './locales/gu.json';

const STORAGE_KEY = 'swadeshi_khata_lang';
const savedLang =
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || 'en' : 'en';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ta: { translation: ta },
    bn: { translation: bn },
    mr: { translation: mr },
    te: { translation: te },
    gu: { translation: gu },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
    document.documentElement.lang = lng;
    const brandName = i18n.t('brand.name', { defaultValue: 'Swadeshi Khata' });
    const tagline = i18n.t('brand.tagline', { defaultValue: 'Aapka hisaab, aapka bharosa' });
    document.title = `${brandName} — ${tagline}`;
  }
});

export default i18n;
