import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const quickLinks = [
  { to: '/favorites', labelKey: 'nav.favorites', fallback: 'Favorites' },
  { to: '/cart', labelKey: 'nav.cart', fallback: 'Cart' },
  { to: '/products', labelKey: 'nav.shop', fallback: 'Shop' },
  { to: '/heritage-map', labelKey: 'nav.heritageMap', fallback: 'Heritage Map' },
  { to: '/visual-match', labelKey: 'nav.visualMatch', fallback: 'Visual Match' },
  { to: '/order-tracking', labelKey: 'nav.trackOrder', fallback: 'Track Order' },
  { to: '/about', labelKey: 'nav.aboutUs', fallback: 'About Us' },
];

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-line bg-white">
      <div className="section-shell grid gap-8 py-10 md:grid-cols-3">
        <div>
          <h2 className="font-display text-4xl text-ink">Athar</h2>
          <p className="mt-3 text-sm leading-7 text-ink-soft">
            {t('footer.description', 'Heritage-inspired accessories presented through a soft, refined storefront experience.')}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">{t('footer.quickLinks', 'Quick links')}</h3>
          <div className="mt-3 space-y-2 text-sm text-ink-soft">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block w-fit transition hover:text-ink"
              >
                {t(link.labelKey, link.fallback)}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-ink">{t('footer.contact', 'Contact')}</h3>
          <div className="mt-3 space-y-2 text-sm text-ink-soft">
            <p>Nablus, Palestine</p>
            <p>hello@athar.ps</p>
            <p>+970 59 123 4567</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
