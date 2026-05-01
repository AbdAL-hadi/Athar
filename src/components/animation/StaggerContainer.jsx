import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const STAGGER_EASE = [0.22, 1, 0.36, 1];

const StaggerContainer = forwardRef(({
  children,
  className = '',
  delayChildren = 0,
  immediate = false,
  once = true,
  amount = 0.2,
}, ref) => {
  const prefersReducedMotion = useReducedMotion();

  const variants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        delayChildren: prefersReducedMotion ? 0 : delayChildren,
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
        ease: STAGGER_EASE,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      {...(immediate
        ? { animate: 'show' }
        : {
            whileInView: 'show',
            viewport: { once, amount },
          })}
    >
      {children}
    </motion.div>
  );
});

StaggerContainer.displayName = 'StaggerContainer';

export default StaggerContainer;
