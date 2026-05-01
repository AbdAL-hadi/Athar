import { motion, useReducedMotion } from 'framer-motion';

const REVEAL_EASE = [0.22, 1, 0.36, 1];

const Reveal = ({
  children,
  delay = 0,
  y = 24,
  className = '',
  immediate = false,
  once = true,
  amount = 0.2,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const hiddenOffset = prefersReducedMotion ? 0 : y;
  const transition = {
    duration: prefersReducedMotion ? 0.2 : 0.65,
    delay: prefersReducedMotion ? 0 : delay,
    ease: REVEAL_EASE,
  };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: hiddenOffset }}
      {...(immediate
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once, amount },
          })}
      transition={transition}
    >
      {children}
    </motion.div>
  );
};

export default Reveal;
