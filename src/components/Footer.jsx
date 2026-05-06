import { Link } from 'react-router-dom';

const quickLinks = [
  { to: '/favorites', label: 'Favorite' },
  { to: '/cart', label: 'Cart' },
  { to: '/products', label: 'Shop' },
  { to: '/heritage-map', label: 'Heritage Map' },
  { to: '/visual-match', label: 'Visual Match' },
  { to: '/order-tracking', label: 'Track Order' },
  { to: '/about', label: 'About Us' },
];

const Footer = () => {
  return (
    <footer className="border-t border-line bg-white">
      <div className="section-shell grid gap-8 py-10 md:grid-cols-3">
        <div>
          <h2 className="font-display text-4xl text-ink">Athar</h2>
          <p className="mt-3 text-sm leading-7 text-ink-soft">
            Heritage-inspired accessories presented through a soft, refined storefront experience.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Quick links</h3>
          <div className="mt-3 space-y-2 text-sm text-ink-soft">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block w-fit transition hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Contact</h3>
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
