import { Link } from 'react-router-dom';
import { resolveApiAssetUrl } from '../utils/api';
import { LOYALTY_REWARDS } from '../utils/loyaltyPoints';

const FALLBACK_LOYALTY_POINTS = 240;
const FREE_SHIPPING_REWARD_POINTS = 300;

const earnOptions = [
  {
    title: 'Create an account',
    value: '+25 points',
    description: 'Join Athar Rewards to start saving points and keep your tier progress in one place.',
    icon: 'account',
  },
  {
    title: 'Place your first order',
    value: '+75 points',
    description: 'Earn a welcome bonus after your first Athar piece is purchased and confirmed.',
    icon: 'order',
  },
  {
    title: 'Earn on every dollar',
    value: '1 point / $1',
    description: 'Collect points for every dollar spent on handcrafted accessories, gifts, and keepsakes.',
    icon: 'spend',
  },
  {
    title: 'Write a product review',
    value: '+40 points',
    description: 'Share your experience after delivery so another customer can choose with confidence.',
    icon: 'review',
  },
  {
    title: 'Share with a friend',
    value: '+50 points',
    description: 'Send Athar to someone you love and earn points when they create their first account.',
    icon: 'share',
  },
  {
    title: 'Receive a birthday reward',
    value: '+50 points',
    description: 'Add your birthday to receive a yearly points gift from Athar.',
    icon: 'birthday',
  },
];

const redeemOptions = LOYALTY_REWARDS;

const tierLevels = [
  {
    name: 'Olive Seed',
    level: 'First level',
    minPoints: 0,
    range: '0-499 points',
    description: 'A rooted beginning for every Athar story, inspired by the olive branch and first collected memories.',
    accent: 'bg-[#6f7f58]',
  },
  {
    name: 'Jasmine Bloom',
    level: 'Second level',
    minPoints: 500,
    range: '500-999 points',
    description: 'A softer stage of growth, named for jasmine courtyards, city evenings, and graceful return visits.',
    accent: 'bg-[#b9977a]',
  },
  {
    name: 'Golden Key',
    level: 'Third level',
    minPoints: 1000,
    range: '1,000-1,499 points',
    description: 'A symbol of doors, homes, and access to more meaningful rewards across the Athar journey.',
    accent: 'bg-[#b88746]',
  },
  {
    name: 'Heritage Keeper',
    level: 'Highest level',
    minPoints: 1500,
    range: '1,500+ points',
    description: 'The highest circle for customers who carry Athar stories forward through craft, culture, and care.',
    accent: 'bg-[#574338]',
  },
];

const cityBadges = [
  {
    city: 'Gaza',
    title: 'Gaza Rose',
    story: 'Inspired by embroidered florals, sea air, and the resilience woven into coastal craft.',
    status: 'Collected',
    accent: 'from-[#8f5f45] to-[#c48f73]',
  },
  {
    city: 'Bethlehem',
    title: 'Bethlehem Star',
    story: 'A badge for star motifs, carved light, and pieces shaped by one of the oldest city stories.',
    status: 'Collect next',
    accent: 'from-[#b88746] to-[#dfbd79]',
  },
  {
    city: 'Jerusalem',
    title: 'Golden Gate',
    story: 'Collected through pieces that carry doors, keys, stone paths, and layered heritage.',
    status: 'Explore',
    accent: 'from-[#574338] to-[#98715d]',
  },
  {
    city: 'Nablus',
    title: 'Olive Market',
    story: 'Earned through designs inspired by olive groves, soap houses, markets, and old-city craft.',
    status: 'Explore',
    accent: 'from-[#54715f] to-[#9aa879]',
  },
];

const PointsMark = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M12 3.75 14.4 8.6l5.35.78-3.87 3.78.91 5.33L12 15.97 7.21 18.5l.91-5.33-3.87-3.78 5.35-.78L12 3.75Z" />
  </svg>
);

const RewardGlyph = ({ label }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-ink shadow-[inset_0_0_0_1px_rgba(239,227,220,0.95)]">
    <span className="font-display text-2xl font-bold leading-none">{label}</span>
  </div>
);

const CityBadgeIcon = ({ city, accent }) => {
  const initials = city.slice(0, 2).toUpperCase();

  return (
    <div className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${accent} text-white shadow-[0_18px_35px_rgba(80,45,28,0.18)]`}>
      <div className="absolute inset-2 rounded-full border border-white/55" />
      <div className="absolute inset-4 rounded-full border border-white/25" />
      <span className="font-display text-4xl font-bold leading-none">{initials}</span>
    </div>
  );
};

const formatPointsCount = (points) => Math.max(0, Math.round(Number(points) || 0)).toLocaleString('en-US');

const formatTierRange = (minPoints, maxPoints = null) => {
  if (maxPoints == null) {
    return `${formatPointsCount(minPoints)}+ points`;
  }

  return `${formatPointsCount(minPoints)}-${formatPointsCount(maxPoints)} points`;
};

const EarnIcon = ({ type }) => {
  const commonProps = {
    'aria-hidden': 'true',
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '1.8',
    viewBox: '0 0 24 24',
  };

  if (type === 'account') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M18.5 6.5v4" />
        <path d="M20.5 8.5h-4" />
      </svg>
    );
  }

  if (type === 'order') {
    return (
      <svg {...commonProps}>
        <path d="M6.5 8.5h11l-.86 9.02a2 2 0 0 1-1.99 1.81h-5.3a2 2 0 0 1-1.99-1.81L6.5 8.5Z" />
        <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
        <path d="m9.5 13 1.8 1.8 3.5-3.6" />
      </svg>
    );
  }

  if (type === 'spend') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9" />
        <path d="M15 9.5c-.55-1-1.6-1.5-3-1.5-1.65 0-2.75.8-2.75 2s1.1 1.75 2.75 2 2.75.8 2.75 2-1.1 2-2.75 2c-1.45 0-2.55-.55-3.15-1.6" />
      </svg>
    );
  }

  if (type === 'review') {
    return (
      <svg {...commonProps}>
        <path d="M6.25 5.25h11.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.5L7 19.25v-3h-.75a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
        <path d="m9 10.8 1.7 1.7L15 8.4" />
      </svg>
    );
  }

  if (type === 'share') {
    return (
      <svg {...commonProps}>
        <circle cx="6.5" cy="12" r="2.5" />
        <circle cx="17.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
        <path d="m8.7 10.85 6.6-3.3" />
        <path d="m8.7 13.15 6.6 3.3" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4.75 11.25h14.5v8h-14.5z" />
      <path d="M12 11.25v8" />
      <path d="M3.75 8.25h16.5v3h-16.5z" />
      <path d="M12 8.25c-1.7-3.4-5.6-2.9-5.6-.8 0 1.55 2.05 1.8 5.6.8Z" />
      <path d="M12 8.25c1.7-3.4 5.6-2.9 5.6-.8 0 1.55-2.05 1.8-5.6.8Z" />
    </svg>
  );
};

const LoyaltyRewardsPage = ({ authUser }) => {
  const firstName = authUser?.name?.split(' ')?.[0] || 'Athar member';
  const heroImage = resolveApiAssetUrl('design/about-campaign-2.jpeg');
  const logoImage = resolveApiAssetUrl('design/logo.jpeg');
  const currentPoints = authUser
    ? Math.max(Number(authUser?.atharPoints ?? 0), Number(authUser?.loyaltyPoints ?? 0))
    : FALLBACK_LOYALTY_POINTS;
  const currentTier =
    [...tierLevels].reverse().find((tier) => currentPoints >= tier.minPoints) ?? tierLevels[0];
  const nextTier = tierLevels.find((tier) => tier.minPoints > currentPoints);
  const currentTierMin = currentTier.minPoints;
  const currentTierMax = nextTier ? nextTier.minPoints : currentTier.minPoints;
  const currentTierRange = formatTierRange(currentTierMin, nextTier ? nextTier.minPoints - 1 : null);
  const pointsEarnedInTier = Math.max(0, currentPoints - currentTierMin);
  const pointsNeededForTier = nextTier ? Math.max(1, nextTier.minPoints - currentTierMin) : Math.max(1, currentTierMin || 1);
  const progressPercent = nextTier
    ? Math.min(100, Math.round((pointsEarnedInTier / pointsNeededForTier) * 100))
    : 100;
  const tierPointsRemaining = nextTier ? Math.max(0, nextTier.minPoints - currentPoints) : 0;
  const freeShippingUnlocked = currentPoints >= FREE_SHIPPING_REWARD_POINTS;
  const remainingPoints = Math.max(0, FREE_SHIPPING_REWARD_POINTS - currentPoints);
  const pointsToNextTier = nextTier ? nextTier.minPoints - currentPoints : 0;
  const collectedCityBadgeCount = cityBadges.filter((badge) => badge.status === 'Collected').length;
  const nextCityBadge = cityBadges.find((badge) => badge.status !== 'Collected') ?? cityBadges[0];
  const readyRewards = redeemOptions.filter((reward) => currentPoints >= reward.cost);
  const readyRewardSummary = readyRewards.length > 0
    ? readyRewards.map((reward) => reward.title).join(' + ')
    : 'Keep earning';
  const heritageMoments = ['Handcrafted rewards', 'Warm member benefits', 'Heritage-inspired tiers'];

  return (
    <div className="athar-rewards-page min-h-screen overflow-hidden pb-14">
      <section className="section-shell pt-10">
        <div className="heritage-surface rounded-[32px] border">
          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="athar-gold-rule mb-4" />
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">Athar Rewards</p>
                  <h1 className="mt-3 font-display text-5xl font-bold leading-tight text-ink sm:text-6xl">
                    My Athar Points
                  </h1>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {heritageMoments.map((item) => (
                      <span key={item} className="heritage-pill">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {authUser ? (
                  <Link
                    to="/profile"
                    className="inline-flex items-center justify-center rounded-full border border-[#d9c2b0] bg-[#fff7f0] px-5 py-3 text-sm font-semibold text-ink transition hover:border-[#b88746] hover:bg-white"
                  >
                    Signed in as {firstName}
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    className="inline-flex items-center justify-center rounded-full bg-[#574338] px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
                  >
                    Log in to your account
                  </Link>
                )}
              </div>

              <div className="mt-10 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.72fr)]">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Available balance</p>
                  <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                    <span className="font-display text-8xl font-bold leading-none text-ink sm:text-9xl">
                      {formatPointsCount(currentPoints)}
                    </span>
                    <span className="pb-3 text-xl font-semibold text-ink-soft">points</span>
                  </div>
                </div>

                <div className="heritage-panel rounded-[24px] px-5 py-5">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Current tier</p>
                  <p className="mt-3 font-display text-4xl font-bold text-ink">{currentTier.name}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {currentTier.level} shaped around collected points, cultural details, and the beginning of your Athar story.
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-base font-semibold text-ink">
                    {nextTier ? `Progress toward ${nextTier.name}` : 'Current tier progress'}
                  </p>
                  <p className="text-base font-bold text-ink">
                    {nextTier
                      ? `${formatPointsCount(currentPoints)} / ${formatPointsCount(currentTierMax)} points`
                      : `${formatPointsCount(currentPoints)} points`}
                  </p>
                </div>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  Tier range: {currentTierRange}
                </p>

                <div
                  className="mt-4 h-4 overflow-hidden rounded-full border border-line bg-cream"
                  role="progressbar"
                  aria-label={nextTier ? `Progress toward ${nextTier.name}` : 'Current tier progress'}
                  aria-valuemin={currentTierMin}
                  aria-valuemax={currentTierMax}
                  aria-valuenow={nextTier ? Math.min(currentPoints, currentTierMax) : currentPoints}
                >
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#54715f_0%,#b88746_55%,#dfbd79_100%)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="mt-4 text-lg font-semibold leading-8 text-ink">
                  {nextTier
                    ? `You are only ${formatPointsCount(tierPointsRemaining)} points away from ${nextTier.name}.`
                    : 'You have reached the highest Athar tier.'}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {freeShippingUnlocked
                    ? 'Free shipping is unlocked for your next eligible order.'
                    : `Free shipping unlocks in ${formatPointsCount(remainingPoints)} more points.`}
                </p>
              </div>
            </div>

            <div className="relative min-h-[340px] bg-[#3b261f]">
              <img
                src={heroImage}
                alt="Athar heritage campaign"
                className="absolute inset-0 h-full w-full object-cover opacity-[0.65]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(59,38,31,0.93),rgba(84,113,95,0.5))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(223,189,121,0.22),transparent_24%)]" />
                <div className="relative flex h-full flex-col justify-between p-6 text-white sm:p-8">
                  <div className="flex items-center gap-3">
                    <img src={logoImage} alt="Athar" className="h-14 w-14 rounded-full object-cover" />
                  <div>
                    <p className="font-display text-3xl font-bold leading-none">Athar</p>
                    <p className="text-sm text-white/75">Culture carried forward</p>
                  </div>
                </div>

                <div>
                  <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/88 backdrop-blur-sm">
                    Crafted with story
                  </span>
                  <p className="max-w-sm font-display text-4xl font-bold leading-tight">
                    Points with roots in cities, craft, and traditional stories.
                  </p>
                  <p className="mt-5 max-w-sm text-sm leading-7 text-white/75">
                    Earn with every order and redeem toward thoughtful rewards shaped around the Athar customer journey.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="heritage-metric-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Points</p>
            <p className="mt-2 font-display text-4xl font-bold text-ink">{formatPointsCount(currentPoints)}</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">Ready to use or save.</p>
          </article>

          <article className="heritage-metric-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Next reward</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">
              {freeShippingUnlocked ? 'Unlocked' : `${formatPointsCount(remainingPoints)} points`}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              {freeShippingUnlocked ? 'Free shipping is ready.' : 'Until free shipping.'}
            </p>
          </article>

          <article className="heritage-metric-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Tier</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{currentTier.name}</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{formatPointsCount(pointsToNextTier)} points to {nextTier?.name ?? 'top tier'}.</p>
          </article>

          <article className="heritage-metric-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Earn</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{earnOptions.length} ways</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">Shop, review, refer, celebrate.</p>
          </article>

          <article className="heritage-metric-card heritage-metric-card--highlight">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f5f45]">Redeem</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{readyRewards.length} ready</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{readyRewardSummary}</p>
          </article>

          <article className="heritage-metric-card heritage-metric-card--olive">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#54715f]">City badges</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{collectedCityBadgeCount} collected</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">Next: {nextCityBadge.city}.</p>
          </article>
        </div>

        <section className="mt-10">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">Your Tier</p>
              <h2 className="mt-3 font-display text-5xl font-bold text-ink">Your Tier</h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-ink-soft">
              You are currently an <span className="font-semibold text-ink">{currentTier.name}</span>. Collect more points through purchases, profile milestones, and reviews to move into higher Athar tiers.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tierLevels.map((tier) => {
              const isCurrentTier = tier.name === currentTier.name;
              const isUnlocked = currentPoints >= tier.minPoints;

              return (
                <article
                  key={tier.name}
                  className={`relative overflow-hidden rounded-[24px] border p-5 shadow-card ${
                    isCurrentTier
                      ? 'border-[#b88746] bg-[linear-gradient(145deg,#fffaf7_0%,#f3e1d1_64%,#eef2e7_100%)]'
                      : isUnlocked
                        ? 'border-[#d8c6bc] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(255,247,240,0.84))]'
                        : 'border-line bg-white/80'
                  }`}
                >
                  <div className={`h-2 w-20 rounded-full ${tier.accent}`} />
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{tier.level}</p>
                      <h3 className="mt-2 font-display text-3xl font-bold text-ink">{tier.name}</h3>
                    </div>
                    {isCurrentTier ? (
                      <span className="rounded-full bg-[#54715f] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#8f5f45]">{tier.range}</p>
                  <p className="mt-4 min-h-[5.25rem] text-sm leading-7 text-ink-soft">{tier.description}</p>
                  {!isUnlocked ? (
                    <p className="mt-4 inline-flex rounded-full bg-cream px-3 py-2 text-sm font-semibold text-ink">
                      {formatPointsCount(tier.minPoints - currentPoints)} points to unlock
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="heritage-outline mt-5 px-5 py-5">
            <p className="text-base font-semibold leading-8 text-ink">
              {nextTier
                ? `Collect ${formatPointsCount(pointsToNextTier)} more points to reach ${nextTier.name}.`
                : 'You have reached the highest Athar tier.'}
            </p>
            <p className="mt-1 text-sm leading-7 text-ink-soft">
              Higher tiers unlock a more generous rewards path while keeping the experience rooted in Athar&apos;s cities, craft language, and traditional stories.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="heritage-outline px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Account access</p>
            <p className="mt-3 text-lg font-semibold text-ink">
              {authUser ? `Welcome back, ${firstName}.` : 'Log in to keep your rewards close.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to={authUser ? '/profile' : '/auth'} className="button-primary">
                {authUser ? 'Manage account' : 'Log in'}
              </Link>
              {!authUser ? (
                <Link to="/auth?mode=register" className="button-secondary">
                  Create account
                </Link>
              ) : null}
            </div>
          </div>

          <div className="heritage-outline px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Next reward</p>
            <p className="mt-3 font-display text-3xl font-bold text-ink">Free shipping</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Reach 300 points and redeem delivery on a future order.</p>
          </div>

          <div className="heritage-outline px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">Member note</p>
            <p className="mt-3 text-lg font-semibold text-ink">Rewards are applied at checkout.</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Keep earning through purchases, reviews, and profile milestones.</p>
          </div>
        </div>
      </section>

      <section className="section-shell mt-14">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <div>
            <div>
              <div className="athar-gold-rule mb-4" />
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">Ways to Earn</p>
              <h2 className="mt-3 font-display text-5xl font-bold text-ink">Ways to Earn</h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-ink-soft">
                Collect Athar points through simple moments: joining the community, choosing handcrafted pieces, sharing your experience, and celebrating personal milestones.
              </p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {earnOptions.map((option) => (
                <article key={option.title} className="heritage-panel rounded-[24px] p-5 transition hover:-translate-y-1 hover:border-[#d8b36c] hover:shadow-soft">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff7f0] text-[#8f5f45] shadow-[inset_0_0_0_1px_rgba(143,95,69,0.14)] ring-1 ring-[#dfbd79]/25">
                    <EarnIcon type={option.icon} />
                  </div>
                  <div className="mt-5">
                    <p className="font-display text-3xl font-bold text-ink">{option.title}</p>
                    <p className="heritage-pill mt-3 bg-blush px-3 py-1 text-sm font-bold normal-case tracking-[0.04em] text-ink">
                      {option.value}
                    </p>
                    <p className="mt-4 text-sm leading-7 text-ink-soft">{option.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="heritage-surface rounded-[32px] border p-6 xl:sticky xl:top-28">
            <div className="athar-gold-rule mb-4" />
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">Redeem Your Points</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-ink">Redeem Your Points</h2>
            <p className="mt-4 text-sm leading-7 text-ink-soft">
              Turn your {currentPoints} points into rewards at checkout. Available rewards are highlighted as soon as you have enough points.
            </p>

            <div className="mt-6 space-y-3">
              {redeemOptions.map((reward) => {
                const isAvailable = currentPoints >= reward.cost;
                const pointsNeeded = Math.max(0, reward.cost - currentPoints);

                return (
                  <article
                    key={reward.title}
                    className={`rounded-[22px] border px-4 py-4 ${
                      isAvailable ? 'border-[#b88746] bg-[linear-gradient(145deg,#fff7f0_0%,#fffdfb_100%)]' : 'border-line bg-cream/60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#8f5f45] shadow-[inset_0_0_0_1px_rgba(239,227,220,0.95)]">
                        <PointsMark />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`h-1.5 w-16 rounded-full ${reward.accent}`} />
                        <p className="mt-3 font-display text-2xl font-bold leading-tight text-ink">
                          {formatPointsCount(reward.cost)} points = {reward.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-ink-soft">{reward.description}</p>
                        <p className={`mt-3 text-sm font-bold ${isAvailable ? 'text-[#54715f]' : 'text-[#8f5f45]'}`}>
                          {isAvailable ? 'Ready to redeem' : `${formatPointsCount(pointsNeeded)} points away`}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="section-shell mt-14">
          <div className="heritage-surface rounded-[32px] border px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">Reward path</p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink">Keep collecting, keep choosing</h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-ink-soft">
              Discounts, delivery perks, and gifts become available as your Athar points grow.
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell mt-14">
        <div className="heritage-surface rounded-[36px] border">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.78fr_1.22fr] lg:p-10">
            <div>
              <div className="athar-gold-rule mb-4" />
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">City Badges</p>
              <h2 className="mt-3 font-display text-5xl font-bold text-ink">City Badges</h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-ink-soft">
                Collect city badges by discovering pieces inspired by different places and stories.
              </p>
              <p className="mt-4 max-w-xl text-base leading-8 text-ink-soft">
                When you buy a piece inspired by a specific city, Athar adds that city badge to your collection. Each badge carries the place, story, and cultural inspiration behind the piece.
              </p>
              <Link to="/products" className="button-primary mt-7">
                Explore city-inspired pieces
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {cityBadges.map((badge) => (
                <article key={badge.city} className="heritage-panel rounded-[28px] p-5 backdrop-blur transition hover:-translate-y-1 hover:shadow-soft">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <CityBadgeIcon city={badge.city} accent={badge.accent} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-3xl font-bold text-ink">{badge.city}</p>
                        <span className="heritage-pill px-3 py-1 text-xs tracking-[0.14em]">
                          {badge.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold uppercase tracking-[0.16em] text-muted">{badge.title}</p>
                      <p className="mt-4 text-sm leading-7 text-ink-soft">{badge.story}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LoyaltyRewardsPage;
