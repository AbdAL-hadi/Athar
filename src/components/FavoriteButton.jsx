import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const FavoriteButton = ({ active = false, onClick, className = '' }) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={active ? t('favorites.remove', 'Remove from favorites') : t('favorites.add', 'Add to favorites')}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
      animate={active && !prefersReducedMotion ? { scale: [1, 1.16, 1] } : { scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`inline-flex items-center justify-center rounded-full border border-white/60 bg-white/80 text-lg shadow-card transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose/60 ${className} ${
        active ? 'text-[#c65b68]' : 'text-ink-soft'
      }`}
    >
      <span aria-hidden="true">{active ? '\u2665' : '\u2661'}</span>
    </motion.button>
  );
};

export default FavoriteButton;
