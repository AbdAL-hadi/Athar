import { motion, useReducedMotion } from 'framer-motion';

const STAGGER_ITEM_EASE = [0.22, 1, 0.36, 1];

const StaggerItem = ({ children, className = '' }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: {
          opacity: 0,
          y: prefersReducedMotion ? 0 : 20,
        },
        show: {
          opacity: 1,
          y: 0,
        },
      }}
      transition={{
        duration: prefersReducedMotion ? 0.2 : 0.5,
        ease: STAGGER_ITEM_EASE,
      }}
    >
      {children}
    </motion.div>
  );
};

export default StaggerItem;
