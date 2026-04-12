import { Link, NavLink } from 'react-router-dom';
import { resolveApiAssetUrl } from '../utils/api';

const links = [
  { to: '/products', label: 'Products', icon: 'product' },
  { to: '/favorites', label: 'Favorite', icon: 'heart' },
  { to: '/cart', label: 'Cart', icon: 'bag' },
  { to: '/order-tracking', label: 'Track Order', icon: 'track' },
  { to: '/about', label: 'About Athar', icon: 'about' },
];

const iconLinkClass = ({ isActive }) =>
  `relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
    isActive ? 'border-rose bg-blush text-ink' : 'border-transparent text-ink-soft hover:border-line hover:bg-blush/60 hover:text-ink'
  }`;

const HeartIcon = ({ filled = false }) => (
  <svg aria-hidden="true" className="h-5 w-5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M12 20.5s-6.5-4.35-8.5-8.25C1.86 9.1 3.59 5.5 7.25 5.5c2.03 0 3.37 1.06 4.1 2.26.17.28.56.28.73 0 .73-1.2 2.07-2.26 4.1-2.26 3.66 0 5.39 3.6 3.75 6.75-2 3.9-8.5 8.25-8.5 8.25Z" />
  </svg>
);

const BagIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M6.5 9.5h11l-.88 8.36a2 2 0 0 1-1.99 1.79H9.37a2 2 0 0 1-1.99-1.79L6.5 9.5Z" />
    <path d="M9 9.5V8a3 3 0 1 1 6 0v1.5" />
  </svg>
);

const TrackIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M20 10c0 4.42-8 11-8 11S4 14.42 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const AboutIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.5v5" />
    <circle cx="12" cy="7.5" r=".75" fill="currentColor" stroke="none" />
  </svg>
);

const Navbar = ({ cartCount = 0, authUser, authLoading = false }) => {
  const logo = resolveApiAssetUrl('products/athar.jpg');
  const productIcon = resolveApiAssetUrl('products/icons8-product-80.png');

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="section-shell flex flex-col gap-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <Link to="/" className="flex items-center gap-4">
          <div className="rounded-[20px] bg-blush p-1.5">
            <img src={logo} alt="Athar logo" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <div>
            <p className="font-display text-5xl leading-none text-ink">Athar</p>
            <p className="text-sm text-ink-soft">Palestinian-inspired accessories with a soft editorial storefront feel.</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-6">
          <nav className="flex flex-wrap items-center gap-6">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={iconLinkClass} aria-label={link.label} title={link.label}>
                {link.icon === 'heart' ? (
                  <HeartIcon />
                ) : link.icon === 'bag' ? (
                  <BagIcon />
                ) : link.icon === 'track' ? (
                  <TrackIcon />
                ) : link.icon === 'about' ? (
                  <AboutIcon />
                ) : (
                  <img src={productIcon} alt="" className="h-5 w-5 object-contain" />
                )}
                {link.icon === 'bag' && cartCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
                    {cartCount}
                  </span>
                ) : null}
                <span className="sr-only">{link.label}</span>
              </NavLink>
            ))}
          </nav>

          <Link to="/auth" className="button-primary whitespace-nowrap">
            {authLoading ? 'Checking...' : authUser ? `Hi, ${authUser.name.split(' ')[0]}` : 'Create Account / Log In'}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
