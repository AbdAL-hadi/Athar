import { useTranslation } from 'react-i18next';

const LanguageSwitcher = ({ className = '' }) => {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.resolvedLanguage === 'ar' || i18n.language === 'ar';
  const nextLanguage = isArabic ? 'en' : 'ar';

  const handleChangeLanguage = () => {
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <button
      type="button"
      onClick={handleChangeLanguage}
      className={`inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft transition hover:bg-blush/60 hover:text-ink ${className}`}
      aria-label={t('language.switchTo', 'Switch language')}
      title={t('language.label', 'Language')}
    >
      {isArabic ? 'EN' : 'عربي'}
    </button>
  );
};

export default LanguageSwitcher;
