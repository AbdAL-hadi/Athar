import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import AdminNavigation from './admin/AdminNavigation';
import LanguageSwitcher from './LanguageSwitcher';
import { resolveApiAssetUrl } from '../utils/api';

const primaryLinks = [
  { to: '/products', labelKey: 'nav.shop', fallback: 'Shop' },
  { to: '/heritage-map', labelKey: 'nav.heritageMap', fallback: 'Heritage Map' },
  { to: '/visual-match', labelKey: 'nav.visualMatch', fallback: 'Visual Match' },
  { to: '/order-tracking', labelKey: 'nav.trackOrder', fallback: 'Track Order' },
  { to: '/about', labelKey: 'nav.aboutUs', fallback: 'About Us' },
];

const quickLinks = [
  { to: '/search', labelKey: 'nav.search', fallback: 'Search', icon: 'search' },
  { to: '/favorites', labelKey: 'nav.favorites', fallback: 'Favorites', icon: 'heart' },
  { to: '/cart', labelKey: 'nav.cart', fallback: 'Cart', icon: 'bag' },
];

const primaryNavLinkClass = ({ isActive }) =>
  `relative inline-flex items-center py-1 text-[11px] font-semibold uppercase tracking-[0.28em] transition ${
    isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
  }`;

const quickActionClass = ({ isActive }) =>
  `relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
    isActive
      ? 'border-[#cfbeb2] bg-[#fbf4ef] text-ink shadow-[0_10px_24px_rgba(66,47,35,0.10)]'
      : 'border-line bg-white text-ink-soft hover:border-[#d7c4b7] hover:bg-[#faf5f0] hover:text-ink'
  }`;

const mobileNavLinkClass = ({ isActive }) =>
  `flex items-center justify-between rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
    isActive ? 'bg-[#f8efe8] text-ink' : 'text-ink-soft hover:bg-[#fbf5f0] hover:text-ink'
  }`;

const HeartIcon = ({ filled = false, className = 'h-[18px] w-[18px]' }) => (
  <svg aria-hidden="true" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M12 20.5s-6.5-4.35-8.5-8.25C1.86 9.1 3.59 5.5 7.25 5.5c2.03 0 3.37 1.06 4.1 2.26.17.28.56.28.73 0 .73-1.2 2.07-2.26 4.1-2.26 3.66 0 5.39 3.6 3.75 6.75-2 3.9-8.5 8.25-8.5 8.25Z" />
  </svg>
);

const BagIcon = ({ className = 'h-[18px] w-[18px]' }) => (
  <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M6.5 9.5h11l-.88 8.36a2 2 0 0 1-1.99 1.79H9.37a2 2 0 0 1-1.99-1.79L6.5 9.5Z" />
    <path d="M9 9.5V8a3 3 0 1 1 6 0v1.5" />
  </svg>
);

const SearchIcon = ({ className = 'h-[18px] w-[18px]' }) => (
  <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="5.25" />
    <path d="m15 15 4 4" />
  </svg>
);

const AccountIcon = ({ className = 'h-[18px] w-[18px]' }) => (
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

const MenuIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
);

const CloseIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </svg>
);

const MenuAction = ({ icon, label, onClick, tone = 'default', rounded = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition ${
      tone === 'danger' ? 'text-[#9b5a54] hover:bg-[#fbefed]' : 'text-ink hover:bg-[#faf5f0]'
    } ${rounded}`}
    role="menuitem"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const UserAvatar = ({ authUser, sizeClass = 'h-8 w-8', textClass = 'text-sm' }) => {
  if (authUser?.profilePicture) {
    return (
      <img
        src={authUser.profilePicture}
        alt={authUser.name}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`flex ${sizeClass} items-center justify-center rounded-full bg-gradient-to-br from-[#b69063] via-[#c9ab80] to-[#8f5f45] font-semibold text-white ${textClass}`}>
      {authUser?.name?.charAt(0).toUpperCase() || 'U'}
    </div>
  );
};

const QuickActionLink = ({ to, label, icon, badge = 0, onClick, className = '' }) => (
  <NavLink to={to} className={({ isActive }) => `${quickActionClass({ isActive })} ${className}`} aria-label={label} title={label} onClick={onClick}>
    {icon === 'heart' ? <HeartIcon /> : icon === 'bag' ? <BagIcon /> : <SearchIcon />}
    {badge > 0 ? (
      <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
        {badge}
      </span>
    ) : null}
    <span className="sr-only">{label}</span>
  </NavLink>
);

const Navbar = ({ cartCount = 0, authUser, authLoading = false, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef(null);
  const logo = resolveApiAssetUrl('products/athar.jpg');
  const homeTarget = authUser?.role === 'admin' ? '/admin/dashboard' : '/';
  const isAdmin = authUser?.role === 'admin';
  const firstName = authUser?.name?.split(' ')[0] || t('nav.account', 'Account');

  const closeAllMenus = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  };

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
    closeAllMenus();
  }, [authUser?.id, location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      setIsScrolled((currentValue) => {
        if (!currentValue && scrollY > 150) {
          return true;
        }

        if (currentValue && scrollY < 24) {
          return false;
        }

        return currentValue;
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleDropdown = () => {
    setMobileMenuOpen(false);
    setDropdownOpen((currentValue) => !currentValue);
  };

  const toggleMobileMenu = () => {
    setDropdownOpen(false);
    setMobileMenuOpen((currentValue) => !currentValue);
  };

  const handleProfileClick = () => {
    closeAllMenus();
    navigate('/profile');
  };

  const handleLoginClick = () => {
    closeAllMenus();
    navigate('/auth?mode=login');
  };

  const handleRegisterClick = () => {
    closeAllMenus();
    navigate('/auth?mode=register');
  };

  const handleLogoutClick = () => {
    closeAllMenus();
    onLogout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-[1200] border-b border-line bg-white/95 backdrop-blur transition-shadow duration-300">
      <div className={`w-full bg-[#52603e] transition-all duration-300 ${isScrolled ? 'h-0' : 'h-1'}`} />

      <div className="hidden lg:block">
        <div
          className={`section-shell relative z-[3] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 transition-all duration-300 ease-out ${
            isScrolled ? 'max-h-0 py-0 opacity-0' : 'max-h-44 py-6 opacity-100'
          } ${dropdownOpen && !isScrolled ? 'overflow-visible' : 'overflow-hidden'}`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#5f6547]">{t('nav.craftHouse', 'Palestinian Craft House')}</p>
            <p className="mt-1 max-w-xs text-sm text-ink-soft">{t('nav.tagline', 'Heritage-inspired pieces, thoughtful gifting, and signature copper details.')}</p>
          </div>

          <Link to={homeTarget} className="justify-self-center text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#dcc8bb] bg-[#faf7f4] p-1.5 shadow-[0_14px_32px_rgba(66,47,35,0.10)]">
              <img
                src={logo}
                alt="Athar emblem"
                className="h-full w-full rounded-full object-cover"
                style={{ objectPosition: 'center 17%' }}
              />
            </div>
            <p className="mt-3 font-display text-4xl leading-none text-ink">Athar</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-[#5f6547]">{t('nav.brandLine', 'Copper & Embroidery')}</p>
          </Link>

          <div className="flex items-center justify-end gap-3">
            <LanguageSwitcher className="hidden xl:inline-flex" />
            {!isAdmin ? (
              <>
                <div className="hidden xl:inline-flex items-center rounded-full border border-line bg-[#fbf8f5] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#5f6547]">
                  {t('nav.madeInPalestine', 'Made in Palestine')}
                </div>
                {quickLinks.map((link) => (
                  <QuickActionLink
                    key={link.to}
                    to={link.to}
                    label={t(link.labelKey, link.fallback)}
                    icon={link.icon}
                    badge={link.icon === 'bag' ? cartCount : 0}
                  />
                ))}
              </>
            ) : null}

            {authLoading ? (
              <div className="rounded-full border border-line bg-[#fbf8f5] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                {t('common.checking', 'Checking...')}
              </div>
            ) : authUser ? (
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={toggleDropdown}
                  className="flex items-center gap-3 rounded-full border border-[#d8c7ba] bg-white px-2 py-2 transition hover:bg-[#faf5f0]"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                >
                  <UserAvatar authUser={authUser} sizeClass="h-9 w-9" textClass="text-sm" />
                  <span className="hidden max-w-[100px] truncate text-sm font-semibold text-ink xl:block">{firstName}</span>
                  <ChevronDownIcon open={dropdownOpen} />
                </button>

                {dropdownOpen ? (
                  <div className="absolute right-0 z-[1300] mt-3 w-60 overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_24px_56px_rgba(66,47,35,0.12)]" role="menu">
                    <div className="flex items-center gap-3 border-b border-line/50 bg-[#fcf8f5] px-4 py-4">
                      <UserAvatar authUser={authUser} sizeClass="h-12 w-12" textClass="text-base" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{authUser.name}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{authUser.role}</p>
                      </div>
                    </div>

                    <MenuAction icon={<ProfileIcon />} label={t('nav.profile', 'Profile')} onClick={handleProfileClick} />
                    <MenuAction icon={<LogoutIcon />} label={t('nav.signOut', 'Sign Out')} onClick={handleLogoutClick} tone="danger" rounded="rounded-b-[26px]" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={toggleDropdown}
                  className="flex items-center gap-3 rounded-full border border-[#d8c7ba] bg-white px-3 py-2 transition hover:bg-[#faf5f0]"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7ede6] text-ink">
                    <AccountIcon />
                  </span>
                  <span className="text-sm font-semibold text-ink">{t('nav.account', 'Account')}</span>
                  <ChevronDownIcon open={dropdownOpen} />
                </button>

                {dropdownOpen ? (
                  <div className="absolute right-0 z-[1300] mt-3 w-64 overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_24px_56px_rgba(66,47,35,0.12)]" role="menu">
                    <div className="flex items-center gap-3 border-b border-line/50 bg-[#fcf8f5] px-4 py-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f7ede6] text-ink">
                        <AccountIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{t('nav.welcome', 'Welcome to Athar')}</p>
                        <p className="text-xs text-ink-soft">{t('nav.guestHelper', 'Log in or create an account to save favorites and track orders.')}</p>
                      </div>
                    </div>

                    <MenuAction icon={<LoginIcon />} label={t('nav.logIn', 'Log In')} onClick={handleLoginClick} />
                    <MenuAction icon={<RegisterIcon />} label={t('nav.createAccount', 'Create Account')} onClick={handleRegisterClick} rounded="rounded-b-[26px]" />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className={`relative z-[1] transition-colors duration-300 ${isScrolled ? 'border-t border-transparent shadow-[0_12px_30px_rgba(66,47,35,0.08)]' : 'border-t border-line/70'}`}>
          <div className="section-shell">
            {isAdmin ? (
              <div className={`flex justify-center transition-all duration-300 ${isScrolled ? 'py-3' : 'py-4'}`}>
                <AdminNavigation className="justify-center" />
              </div>
            ) : (
              <nav className={`flex items-center justify-center gap-7 transition-all duration-300 xl:gap-9 ${isScrolled ? 'py-3' : 'py-4'}`} aria-label="Primary navigation">
                {primaryLinks.map((link) => (
                  <NavLink key={link.to} to={link.to} className={primaryNavLinkClass}>
                    {({ isActive }) => (
                      <>
                        <span>{t(link.labelKey, link.fallback)}</span>
                        {isActive ? <span className={`absolute left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[#52603e] ${isScrolled ? '-bottom-3' : '-bottom-4'}`} /> : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="section-shell flex items-center justify-between gap-3 py-3">
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:bg-[#faf5f0]"
            aria-expanded={mobileMenuOpen}
            aria-controls="athar-mobile-menu"
            aria-label={mobileMenuOpen ? t('nav.closeMenu', 'Close navigation menu') : t('nav.openMenu', 'Open navigation menu')}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <Link to={homeTarget} className="min-w-0 flex items-center gap-3" onClick={closeAllMenus}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dcc8bb] bg-[#faf7f4] p-1.5 shadow-[0_12px_24px_rgba(66,47,35,0.10)]">
              <img
                src={logo}
                alt="Athar emblem"
                className="h-full w-full rounded-full object-cover"
                style={{ objectPosition: 'center 17%' }}
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-3xl leading-none text-ink">Athar</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-[#5f6547]">{t('nav.brandLine', 'Copper & Embroidery')}</p>
            </div>
          </Link>

          <QuickActionLink
            to="/cart"
            label={t('nav.cart', 'Cart')}
            icon="bag"
            badge={cartCount}
            className="h-11 w-11 shrink-0"
            onClick={closeAllMenus}
          />
        </div>

        {mobileMenuOpen ? (
          <div id="athar-mobile-menu" className="border-t border-line/70 bg-white/98 pb-5 pt-4">
            <div className="section-shell space-y-4">
              {!isAdmin ? (
                <>
                  <div className="flex justify-end">
                    <LanguageSwitcher />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {quickLinks.map((link) => (
                      <QuickActionLink
                        key={link.to}
                        to={link.to}
                        label={t(link.labelKey, link.fallback)}
                        icon={link.icon}
                        badge={link.icon === 'bag' ? cartCount : 0}
                        className="h-12 w-full rounded-[20px]"
                        onClick={closeAllMenus}
                      />
                    ))}
                  </div>

                  <div className="rounded-[28px] border border-line bg-[#fcf8f5] p-2">
                    <nav className="space-y-1" aria-label="Mobile navigation">
                      {primaryLinks.map((link) => (
                        <NavLink key={link.to} to={link.to} className={mobileNavLinkClass} onClick={closeAllMenus}>
                          <span>{t(link.labelKey, link.fallback)}</span>
                          <span className="text-base leading-none text-[#8f5f45]">+</span>
                        </NavLink>
                      ))}
                    </nav>
                  </div>
                </>
              ) : (
                <div className="rounded-[28px] border border-line bg-[#fcf8f5] px-4 py-5">
                  <AdminNavigation className="justify-center" />
                  <div className="mt-4 flex justify-center">
                    <LanguageSwitcher />
                  </div>
                </div>
              )}

              {authLoading ? (
                <div className="rounded-[28px] border border-line bg-[#fcf8f5] px-4 py-5 text-center text-sm font-semibold text-ink-soft">
                  {t('nav.checkingAccount', 'Checking your account...')}
                </div>
              ) : authUser ? (
                <div className="rounded-[28px] border border-line bg-[#fcf8f5] px-4 py-5">
                  <div className="flex items-center gap-3">
                    <UserAvatar authUser={authUser} sizeClass="h-12 w-12" textClass="text-base" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{authUser.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{authUser.role}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={handleProfileClick} className="button-secondary justify-center text-sm">
                      {t('nav.profile', 'Profile')}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      className="inline-flex items-center justify-center rounded-full border border-[#d8b5b2] bg-white px-4 py-3 text-sm font-semibold text-[#8f5f45] transition hover:bg-[#faf0ee]"
                    >
                      {t('nav.signOut', 'Sign Out')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-line bg-[#fcf8f5] px-4 py-5">
                  <p className="text-sm font-semibold text-ink">{t('nav.welcome', 'Welcome to Athar')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t('nav.mobileGuestHelper', 'Sign in to save favorites, track orders, and continue your collection.')}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={handleLoginClick} className="button-secondary justify-center text-sm">
                      {t('nav.logIn', 'Log In')}
                    </button>
                    <button type="button" onClick={handleRegisterClick} className="button-primary justify-center text-sm">
                      {t('nav.createAccount', 'Create Account')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Navbar;
