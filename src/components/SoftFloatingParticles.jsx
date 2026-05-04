import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './SoftFloatingParticles.css';

const DEFAULT_COLORS = [
  'rgba(255, 255, 248, 1)',
  'rgba(250, 225, 163, 0.95)',
  'rgba(255, 239, 200, 0.92)',
  'rgba(222, 166, 76, 0.78)',
];

const PARTICLE_LIMITS = {
  desktop: 180,
  tablet: 90,
  mobile: 48,
  reducedMotion: 8,
};

const clampNumber = (value, fallback) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const buildParticle = ({
  index,
  colors,
  minSize,
  maxSize,
  opacity,
  speed,
}) => {
  const sizeRange = Math.max(0, maxSize - minSize);
  const size = minSize + ((index * 7) % (sizeRange + 1));
  //const duration = Math.max(12, (24 + ((index * 5) % 18)) / speed);
  const duration = Math.max(5, (12 + ((index * 5) % 10)) / speed);
  const driftX = index % 2 === 0 ? 18 + (index % 8) * 4 : -16 - (index % 7) * 4;
  const driftY = (index % 3 === 0 ? -68 : 72) + (index % 6) * 10;
  const baseOpacity = 0.42 + (index % 5) * 0.075;

  return {
    id: `soft-floating-particle-${index}`,
    style: {
      '--particle-size': `${size}px`,
      '--particle-x': `${(index * 37) % 100}%`,
      '--particle-y': `${(index * 23) % 100}%`,
      '--particle-color': colors[index % colors.length],
      '--particle-opacity': Math.min(baseOpacity * opacity, 0.92),
      '--particle-blur': `${index % 4 === 0 ? 2.2 : 0.65}px`,
      '--particle-duration': `${duration}s`,
      '--particle-delay': `-${(index * 2.9) % duration}s`,
      '--particle-drift-x': `${driftX}px`,
      '--particle-drift-y': `${driftY}px`,
      '--particle-scale': `${0.85 + (index % 4) * 0.18}`,
    },
  };
};

const getParticleLimit = () => {
  if (typeof window === 'undefined') {
    return PARTICLE_LIMITS.desktop;
  }

  if (window.matchMedia('(max-width: 640px)').matches) {
    return PARTICLE_LIMITS.mobile;
  }

  if (window.matchMedia('(max-width: 900px)').matches) {
    return PARTICLE_LIMITS.tablet;
  }

  return PARTICLE_LIMITS.desktop;
};

const useResponsiveParticleLimit = () => {
  const [limit, setLimit] = useState(getParticleLimit);

  useEffect(() => {
    const updateLimit = () => setLimit(getParticleLimit());
    updateLimit();

    window.addEventListener('resize', updateLimit);
    return () => window.removeEventListener('resize', updateLimit);
  }, []);

  return limit;
};

const SoftFloatingParticles = ({
  count = 56,
  className = '',
  colors = DEFAULT_COLORS,
  minSize = 4,
  maxSize = 14,
  opacity = 1,
  speed = 10,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const responsiveLimit = useResponsiveParticleLimit();
  const safeColors = Array.isArray(colors) && colors.length > 0 ? colors : DEFAULT_COLORS;
  const safeMinSize = Math.max(1, Math.round(clampNumber(minSize, 2)));
  const safeMaxSize = Math.max(safeMinSize, Math.round(clampNumber(maxSize, 9)));
  const safeOpacity = Math.max(0, clampNumber(opacity, 1));
  const safeSpeed = Math.max(0.25, clampNumber(speed, 1));
  const requestedCount = Math.max(0, Math.round(clampNumber(count, 35)));
  const particleCount = prefersReducedMotion
    ? Math.min(requestedCount, PARTICLE_LIMITS.reducedMotion)
    : Math.min(requestedCount, responsiveLimit);

  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, index) =>
        buildParticle({
          index,
          colors: safeColors,
          minSize: safeMinSize,
          maxSize: safeMaxSize,
          opacity: safeOpacity,
          speed: safeSpeed,
        }),
      ),
    [particleCount, safeColors, safeMinSize, safeMaxSize, safeOpacity, safeSpeed],
  );

  return (
    <div
      className={`soft-floating-particles ${prefersReducedMotion ? 'soft-floating-particles--reduced' : ''} ${className}`}
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <span key={particle.id} className="soft-floating-particle" style={particle.style} />
      ))}
    </div>
  );
};

export default SoftFloatingParticles;
