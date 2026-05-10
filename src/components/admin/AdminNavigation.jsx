import { NavLink } from 'react-router-dom';

const adminLinks = [
  { to: '/employee-dashboard', label: 'All Products' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/comments', label: 'Comments' },
  { to: '/admin/dashboard', label: 'Admin Dashboard' },
];

const getAdminLinkClass = ({ isActive }) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? 'border-rose bg-blush text-ink shadow-card'
      : 'border-line bg-white text-ink-soft hover:bg-blush/60 hover:text-ink'
  }`;

const AdminNavigation = ({ className = '' }) => (
  <nav className={`flex flex-wrap items-center gap-3 ${className}`} aria-label="Admin navigation">
    {adminLinks.map((link) => (
      <NavLink key={link.to} to={link.to} className={getAdminLinkClass}>
        {link.label}
      </NavLink>
    ))}
  </nav>
);

export default AdminNavigation;
