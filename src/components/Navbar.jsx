import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import AdminNavigation from './admin/AdminNavigation';
import { resolveApiAssetUrl } from '../utils/api';

const links = [
  { to: '/heritage-map', label: 'Heritage Map', icon: 'map' },
  { to: '/products', label: 'Products', icon: 'product' },
  { to: '/visual-match', label: 'Find Similar Product', icon: 'camera' },
  { to: '/rewards', label: 'Rewards', icon: 'reward' },
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

const RewardIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M12 3.75 14.42 8.6l5.35.78-3.88 3.78.92 5.34L12 15.98 7.19 18.5l.92-5.34-3.88-3.78 5.35-.78L12 3.75Z" />
    <path d="M8.2 21h7.6" />
  </svg>
);

const MapIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="m3.5 6.5 5-2 7 2 5-2v13l-5 2-7-2-5 2v-13Z" />
    <path d="M8.5 4.5v13M15.5 6.5v13" />
  </svg>
);

const AboutIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.5v5" />
    <circle cx="12" cy="7.5" r=".75" fill="currentColor" stroke="none" />
  </svg>
);

const CameraIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M4.5 8.5h3l1.2-2h6.6l1.2 2h3a1.5 1.5 0 0 1 1.5 1.5v7a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 4 17V10a1.5 1.5 0 0 1 1.5-1.5Z" />
    <circle cx="12" cy="13" r="3.25" />
  </svg>
);

const AccountIcon = ({ className = 'h-4 w-4' }) => (
  <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="3.25" />
    <path d="M5.5 18.25a6.5 6.5 0 0 1 13 0" />
  </svg>
);

const ChevronDownIcon = ({ open = false }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    viewBox="0 0 24 24"
  >
    <path d="m6.75 9.75 5.25 5.25 5.25-5.25" />
  </svg>
);

const ProfileIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="3" />
    <path d="M6.5 18a6 6 0 0 1 11 0" />
  </svg>
);

const LoginIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M14.5 8.5 18 12l-3.5 3.5" />
    <path d="M7 12h10.5" />
    <path d="M10 5.5H7.75A2.25 2.25 0 0 0 5.5 7.75v8.5a2.25 2.25 0 0 0 2.25 2.25H10" />
  </svg>
);

const RegisterIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 18a6 6 0 0 1 11 0" />
    <path d="M17 8.5v6" />
    <path d="M14 11.5h6" />
  </svg>
);

const LogoutIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M14.5 8.5 18 12l-3.5 3.5" />
    <path d="M8 12h9.5" />
    <path d="M10 5.5H7.75A2.25 2.25 0 0 0 5.5 7.75v8.5a2.25 2.25 0 0 0 2.25 2.25H10" />
  </svg>
);

const MenuAction = ({ icon, label, onClick, tone = 'default', rounded = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition ${
      tone === 'danger' ? 'text-rose hover:bg-rose/10' : 'text-ink hover:bg-blush'
    } ${rounded}`}
    role="menuitem"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const Navbar = ({ cartCount = 0, authUser, authLoading = false, onLogout }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const logo = resolveApiAssetUrl('products/athar.jpg');
  const productIcon = resolveApiAssetUrl('products/icons8-product-80.png');
  const homeTarget = authUser?.role === 'admin' ? '/admin/dashboard' : '/';

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

  useEffect(() => {
    setDropdownOpen(false);
  }, [authUser?.id]);

  const toggleDropdown = () => {
    setDropdownOpen((currentValue) => !currentValue);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setDropdownOpen(false);
  };

  const handleLoginClick = () => {
    navigate('/auth?mode=login');
    setDropdownOpen(false);
  };

  const handleRegisterClick = () => {
    navigate('/auth?mode=register');
    setDropdownOpen(false);
  };

  const handleLogoutClick = () => {
    onLogout();
    setDropdownOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-[1200] border-b border-line bg-white/95 backdrop-blur">
      <div className="section-shell flex flex-col gap-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <Link to={homeTarget} className="flex items-center gap-4">
          <div className="rounded-[20px] bg-blush p-1.5">
            <img src={logo} alt="Athar logo" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <div>
            <p className="font-display text-5xl leading-none text-ink">Athar</p>
            <p className="text-sm text-ink-soft">Palestinian-inspired accessories with a soft editorial storefront feel.</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {authUser?.role === 'admin' ? (
            <AdminNavigation />
          ) : (
            <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={iconLinkClass} aria-label={link.label} title={link.label}>
                  {link.icon === 'heart' ? (
                    <HeartIcon />
                  ) : link.icon === 'bag' ? (
                    <BagIcon />
                  ) : link.icon === 'track' ? (
                    <TrackIcon />
                  ) : link.icon === 'map' ? (
                    <MapIcon />
                  ) : link.icon === 'camera' ? (
                    <CameraIcon />
                  ) : link.icon === 'reward' ? (
                    <RewardIcon />
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
          )}

          {authLoading ? (
            <div className="button-primary whitespace-nowrap">Checking...</div>
          ) : authUser ? (
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={toggleDropdown}
                className="flex items-center gap-3 rounded-full border-2 border-rose bg-white px-2 py-2 transition hover:bg-blush"
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
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
                <span className="hidden max-w-[100px] truncate font-semibold text-ink sm:block">
                  {authUser.name?.split(' ')[0] || 'Account'}
                </span>
                <ChevronDownIcon open={dropdownOpen} />
              </button>

              {dropdownOpen ? (
                <div className="absolute right-0 z-[1300] mt-2 w-56 rounded-lg border border-line bg-white shadow-lg" role="menu">
                  <div className="flex items-center gap-3 border-b border-line/30 px-4 py-4">
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{authUser.name}</p>
                      <p className="text-xs capitalize text-ink-soft">{authUser.role}</p>
                    </div>
                  </div>

                  <MenuAction icon={<ProfileIcon />} label="Profile" onClick={handleProfileClick} />
                  <MenuAction icon={<LogoutIcon />} label="Sign Out" onClick={handleLogoutClick} tone="danger" rounded="rounded-b-lg" />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={toggleDropdown}
                className="flex items-center gap-3 rounded-full border-2 border-rose bg-white px-3 py-2 transition hover:bg-blush"
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush text-ink">
                  <AccountIcon />
                </span>
                <span className="font-semibold text-ink">Account</span>
                <ChevronDownIcon open={dropdownOpen} />
              </button>

              {dropdownOpen ? (
                <div className="absolute right-0 z-[1300] mt-2 w-64 rounded-lg border border-line bg-white shadow-lg" role="menu">
                  <div className="flex items-center gap-3 border-b border-line/30 px-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blush text-ink">
                      <AccountIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">Welcome to Athar</p>
                      <p className="text-xs text-ink-soft">Log in or create an account to save favorites and track orders.</p>
                    </div>
                  </div>

                  <MenuAction icon={<LoginIcon />} label="Log In" onClick={handleLoginClick} />
                  <MenuAction icon={<RegisterIcon />} label="Create Account" onClick={handleRegisterClick} rounded="rounded-b-lg" />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
