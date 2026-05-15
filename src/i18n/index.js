import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const LANGUAGE_STORAGE_KEY = 'athar-language';
export const SUPPORTED_LANGUAGES = ['en', 'ar'];

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (SUPPORTED_LANGUAGES.includes(storedLanguage)) {
    return storedLanguage;
  }

  const browserLanguage = window.navigator.language?.slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(browserLanguage) ? browserLanguage : 'en';
};

const applyDocumentLanguage = (language) => {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedLanguage = language === 'ar' ? 'ar' : 'en';
  document.documentElement.lang = normalizedLanguage;
  document.documentElement.dir = normalizedLanguage === 'ar' ? 'rtl' : 'ltr';
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
});

applyDocumentLanguage(i18n.language);

i18n.on('languageChanged', (language) => {
  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  applyDocumentLanguage(normalizedLanguage);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  }
});

export default i18n;
