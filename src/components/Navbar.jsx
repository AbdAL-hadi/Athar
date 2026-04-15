import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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

const Navbar = ({ cartCount = 0, authUser, authLoading = false, onLogout }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const logo = resolveApiAssetUrl('products/athar.jpg');
  const productIcon = resolveApiAssetUrl('products/icons8-product-80.png');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleProfileClick = () => {
    navigate('/profile');
    setDropdownOpen(false);
  };

  const handleLogoutClick = () => {
    onLogout();
    setDropdownOpen(false);
    navigate('/');
  };

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

          {authLoading ? (
            <div className="button-primary whitespace-nowrap">Checking...</div>
          ) : authUser ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 rounded-full border-2 border-rose px-2 py-2 transition hover:bg-blush"
              >
                {authUser.profilePicture ? (
                  <img
                    src={authUser.profilePicture}
                    alt={authUser.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose to-pink-400 text-sm font-bold text-white">
                    {authUser.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="max-w-[100px] truncate font-semibold text-ink hidden sm:block">
                  {authUser.name.split(' ')[0]}
                </span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-white shadow-lg z-50">
                  {/* Profile Header in Dropdown */}
                  <div className="border-b border-line/30 px-4 py-4 flex items-center gap-3">
                    {authUser.profilePicture ? (
                      <img
                        src={authUser.profilePicture}
                        alt={authUser.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose to-pink-400 text-lg font-bold text-white">
                        {authUser.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-ink text-sm">{authUser.name}</p>
                      <p className="text-xs text-ink-soft capitalize">{authUser.role}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleProfileClick}
                    className="block w-full px-4 py-3 text-left text-sm text-ink hover:bg-blush first:rounded-t-lg transition"
                  >
                    📋 Profile
                  </button>
                  <button
                    onClick={handleLogoutClick}
                    className="block w-full px-4 py-3 text-left text-sm text-ink hover:bg-rose/10 last:rounded-b-lg transition text-rose"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth" className="button-primary whitespace-nowrap">
              Create Account / Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
