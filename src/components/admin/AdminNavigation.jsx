import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const adminLinks = [
  { to: '/employee-dashboard', labelKey: 'admin.allProducts', fallback: 'All Products' },
  { to: '/admin/inventory', labelKey: 'admin.inventory', fallback: 'Inventory' },
  { to: '/admin/analytics', labelKey: 'admin.analytics', fallback: 'Analytics' },
  { to: '/admin/comments', labelKey: 'admin.comments', fallback: 'Comments' },
  { to: '/admin/dashboard', labelKey: 'admin.adminDashboard', fallback: 'Admin Dashboard' },
];

const getAdminLinkClass = ({ isActive }) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? 'border-rose bg-blush text-ink shadow-card'
      : 'border-line bg-white text-ink-soft hover:bg-blush/60 hover:text-ink'
  }`;

const AdminNavigation = ({ className = '' }) => {
  const { t } = useTranslation();

  return (
    <nav className={`flex flex-wrap items-center gap-3 ${className}`} aria-label={t('admin.adminDashboard', 'Admin navigation')}>
      {adminLinks.map((link) => (
        <NavLink key={link.to} to={link.to} className={getAdminLinkClass}>
          {t(link.labelKey, link.fallback)}
        </NavLink>
      ))}
    </nav>
  );
};

export default AdminNavigation;
