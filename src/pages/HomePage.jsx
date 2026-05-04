import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import SoftFloatingParticles from '../components/SoftFloatingParticles';
import Reveal from '../components/animation/Reveal';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import homepageVideo from '../assets/products/homepage.mp4';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';
import { isProductFavorite } from '../utils/productCatalog';
import { getCatalogCategories } from '../utils/productCatalog';

const CTA_EASE = [0.22, 1, 0.36, 1];
const HERO_MEDIA_ROTATION_MS = 8000;

const ArrowIcon = ({ direction = 'right' }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 ${direction === 'left' ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="m9 5 7 7-7 7" />
  </svg>
);

const ScrollIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="m12 5 0 14" />
    <path d="m6 13 6 6 6-6" />
  </svg>
);

const FeedbackCard = ({ item }) => {
  const initial = item?.name?.charAt(0)?.toUpperCase() || 'A';
  const createdAtLabel = item?.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <article className="rounded-[24px] border border-line/70 bg-white px-5 py-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blush text-xl font-bold text-ink">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-2xl text-ink">{item.name}</h3>
            {createdAtLabel ? (
              <span className="text-xs uppercase tracking-[0.18em] text-muted">
                {createdAtLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-base leading-7 text-ink-soft">{item.message}</p>
        </div>
      </div>
    </article>
  );
};

const HomePage = ({ products, favoriteIds, onToggleFavorite, authUser, authToken, onAddToCart }) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const categoriesRowRef = useRef(null);
  const feedbackListRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackLoadError, setFeedbackLoadError] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [activeHeroMedia, setActiveHeroMedia] = useState('image');
  const categories = getCatalogCategories(products);
  const featuredProducts = products.filter((product) => product.featured).slice(0, 5);
  const currentUserFeedback = authUser
    ? feedbackItems.find((item) => item.userId === authUser.id)
    : null;
  const ctaMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.03, y: -2 },
        whileTap: { scale: 0.97 },
        transition: { duration: 0.28, ease: CTA_EASE },
      };
  const heroVisualMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.04, y: -4 },
        transition: { duration: 0.65, ease: CTA_EASE },
      };

  const handleSearch = (event) => {
    event.preventDefault();
    const trimmedQuery = searchQuery.trim();
    navigate(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : '/search');
  };

  const scrollCategories = (direction) => {
    if (!categoriesRowRef.current) {
      return;
    }

    categoriesRowRef.current.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  const scrollFeedbackDown = () => {
    if (!feedbackListRef.current) {
      return;
    }

    feedbackListRef.current.scrollBy({
      top: 280,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    let isCancelled = false;

    const loadFeedback = async () => {
      setFeedbackLoading(true);
      setFeedbackLoadError('');

      try {
        const response = await apiRequest('/api/feedback');
        const remoteFeedback = Array.isArray(response?.data) ? response.data : [];

        if (!isCancelled) {
          setFeedbackItems(remoteFeedback);
        }
      } catch (error) {
        if (!isCancelled) {
          setFeedbackItems([]);
          setFeedbackLoadError(
            'We could not load community reviews right now.',
          );
        }
      } finally {
        if (!isCancelled) {
          setFeedbackLoading(false);
        }
      }
    };

    loadFeedback();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setFeedbackForm(currentUserFeedback?.message ?? '');
  }, [currentUserFeedback]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveHeroMedia('image');
      return undefined;
    }

    const rotationId = window.setInterval(() => {
      setActiveHeroMedia((currentMedia) =>
        currentMedia === 'image' ? 'video' : 'image',
      );
    }, HERO_MEDIA_ROTATION_MS);

    return () => window.clearInterval(rotationId);
  }, [prefersReducedMotion]);

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    setFeedbackError('');
    setFeedbackSuccess('');

    if (!authUser) {
      setFeedbackError('Please log in to write a review.');
      navigate('/auth');
      return;
    }

    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken) {
      setFeedbackError('Please log in to write a review.');
      navigate('/auth');
      return;
    }

    const normalizedMessage = feedbackForm.replace(/\s+/g, ' ').trim();

    if (normalizedMessage.length < 10) {
      setFeedbackError('Please write at least 10 characters before saving your review.');
      return;
    }

    setFeedbackSubmitting(true);

    try {
      const response = await apiRequest('/api/feedback', {
        method: 'POST',
        token: activeToken,
        body: { message: normalizedMessage },
      });
      const savedFeedback = response?.data ?? null;

      if (savedFeedback) {
        setFeedbackItems((currentItems) => {
          const remoteItems = currentItems.filter((item) => item.id !== savedFeedback.id);

          return [savedFeedback, ...remoteItems];
        });
      }

      if (savedFeedback?.status === 'pending') {
        setFeedbackSuccess('Your review is under review and will appear after approval.');
      } else if (savedFeedback?.status === 'rejected') {
        setFeedbackSuccess('Your review was not published because it may violate community guidelines.');
      } else {
        setFeedbackSuccess(response?.message || 'Your review has been saved.');
      }
      setFeedbackForm(savedFeedback?.message ?? normalizedMessage);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        navigate('/auth');
        return;
      }

      setFeedbackError(
        'We could not save your review right now.',
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="space-y-16 pb-6 pt-0">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden bg-blush/80 py-14 sm:py-16 lg:py-20">
        <SoftFloatingParticles count={200} opacity={1.35} speed={0.72} minSize={6} maxSize={20} />
        <div className="section-shell relative z-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,560px)_minmax(360px,520px)] lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-[560px] pt-2 lg:-ml-12 lg:-translate-y-2 xl:-ml-20 xl:-translate-y-4">
              <Reveal delay={0.12} immediate>
<h1 className="max-w-[540px] overflow-hidden font-display text-[2.55rem] font-semibold leading-[1.18] text-ink sm:text-[3rem] lg:text-[3.25rem] xl:text-[3.45rem]">
  <span className="block">
    A touch of heritage<span className="font-bold tracking-[0.01em] text-ink"></span>
  </span>
  <span className="block">made to shine</span>
</h1>
              </Reveal>
              <Reveal delay={0.22} immediate>
                <p className="mt-6 max-w-[470px] text-base font-semibold leading-8 text-ink">
                  At Athar, we create handcrafted accessories that blend timeless heritage with modern elegance through refined copper details and artistic embroidery.
                </p>
              </Reveal>
              <Reveal delay={0.34} immediate>
                <div className="mt-9 flex flex-wrap gap-3">
                  <motion.div {...ctaMotionProps}>
                    <Link
                      to="/products"
                      className="inline-flex min-w-[160px] items-center justify-center bg-white px-6 py-3 text-base font-semibold text-ink shadow-[0_18px_40px_rgba(43,26,20,0.14)] transition"
                    >
                      View Collection
                    </Link>
                  </motion.div>
                  <motion.div {...ctaMotionProps}>
                    <Link
                      to="/about"
                      className="inline-flex min-w-[160px] items-center justify-center bg-white px-6 py-3 text-base font-semibold text-ink shadow-[0_18px_40px_rgba(43,26,20,0.14)] transition"
                    >
                      Discover Athar
                    </Link>
                  </motion.div>
                </div>
              </Reveal>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <Reveal delay={0.42} immediate className="w-full max-w-[520px]">
                <motion.div className="overflow-hidden shadow-[0_24px_70px_rgba(43,26,20,0.12)]" {...heroVisualMotionProps}>
                  <div className="relative overflow-hidden bg-cream">
                    <img
                      src={resolveApiAssetUrl('products/atharhome.png')}
                      alt="Athar hero collage"
                      className={`w-full max-w-[520px] object-cover transition-opacity duration-1000 ease-out ${
                        activeHeroMedia === 'image' ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <video
                      src={homepageVideo}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out ${
                        activeHeroMedia === 'video' ? 'opacity-100' : 'opacity-0'
                      }`}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={resolveApiAssetUrl('products/atharhome.png')}
                      aria-label="Athar homepage promotional video"
                    >
                      Your browser does not support the homepage video.
                    </video>
                    <div
                      className={`pointer-events-none absolute left-4 top-4 rounded-full bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-ink shadow-card transition-opacity duration-700 ${
                        activeHeroMedia === 'video' ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      Athar story
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            </div>
          </div>

          <Reveal delay={0.52} immediate className="pointer-events-none absolute bottom-2 right-6 hidden lg:block">
            <div className="grid grid-cols-6 gap-3">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} className="h-1 w-1 rounded-full bg-[#cbb7b0]" />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-gradient-to-b from-white via-blush/30 to-cream py-20">
        <div className="section-shell">
          <div className="mb-16">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <Reveal className="flex-1">
                <div className="flex-1">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-rose">
                    View all
                  </p>
                  <h2 className="mb-4 font-display text-5xl font-bold text-ink sm:text-6xl">
                    Featured Pieces
                  </h2>
                  <p className="max-w-2xl text-lg font-medium leading-8 text-ink-soft">
                    A first selection from the collection, styled around the visual language of the Athar storefront. Discover our handpicked favorites.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <motion.div {...ctaMotionProps}>
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-2 rounded-full bg-rose px-6 py-3 font-semibold text-white transition hover:bg-rose/90 hover:shadow-lg"
                  >
                    See full catalog -
                  </Link>
                </motion.div>
              </Reveal>
            </div>
          </div>

          <StaggerContainer immediate className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10 xl:grid-cols-4 2xl:grid-cols-5">
            {featuredProducts.map((product, index) => (
              <StaggerItem key={product.id}>
                <div className="group">
                  <div className="relative h-full rounded-3xl bg-white shadow-lg transition hover:shadow-2xl">
                    <ProductCard
                      product={product}
                      isFavorite={isProductFavorite(favoriteIds, product)}
                      onToggleFavorite={onToggleFavorite}
                      onAddToCart={onAddToCart}
                    />
                    {index < 2 ? (
                      <div className="absolute top-4 right-4 inline-block rounded-full bg-gradient-to-r from-rose to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
                        Popular
                      </div>
                    ) : null}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <Reveal className="mt-16 text-center" delay={0.08}>
            <p className="text-lg font-medium text-ink-soft">
              Curated with care • Premium quality • Customer favorites
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-blush/70 py-8">
        <div className="section-shell">
          <Reveal>
            <SearchBar
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onSubmit={handleSearch}
              placeholder="Search for accessories"
              buttonVariant="secondary"
              inputClassName="bg-white"
              buttonClassName="bg-white"
            />
          </Reveal>
        </div>
      </section>

      <section className="section-shell">
        <Reveal>
          <SectionTitle
            title="Sections"
            description="Image-led category discovery designed to stay simple, elegant, and easy to scan."
          />
        </Reveal>

        <div className="mt-8 space-y-4">
          <Reveal className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => scrollCategories('left')} className="icon-button" aria-label="Scroll sections left">
              <ArrowIcon direction="left" />
            </button>
            <button type="button" onClick={() => scrollCategories('right')} className="icon-button" aria-label="Scroll sections right">
              <ArrowIcon direction="right" />
            </button>
          </Reveal>

          <StaggerContainer
            ref={categoriesRowRef}
            className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            amount={0.1}
          >
            {categories.map((category) => (
              <StaggerItem key={category.name} className="w-[260px] min-w-[260px] sm:w-[280px] sm:min-w-[280px]">
                <Link
                  to={`/products?category=${encodeURIComponent(category.name)}`}
                  className="group block rounded-[28px] bg-white p-3 shadow-card transition hover:-translate-y-1"
                >
                  <img src={category.image} alt={category.name} className="aspect-[4/4.5] w-full rounded-[22px] object-cover" />
                  <div className="mt-4 flex items-center justify-between gap-3 px-2 pb-2">
                    <span className="font-display text-2xl text-ink">{category.name}</span>
                    <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-ink-soft">{category.count}</span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
        <Reveal>
          <motion.div className="overflow-hidden" {...heroVisualMotionProps}>
            <img
              src={resolveApiAssetUrl('products/freegift.jpg')}
              alt="Free gift with every order"
              className="w-full object-cover"
            />
          </motion.div>
        </Reveal>
      </section>

      <section className="bg-blush/80 py-20 sm:py-24">
        <div className="section-shell">
          <Reveal>
            <div className="rounded-[36px] bg-white/60 p-6 text-center shadow-soft backdrop-blur sm:p-8">
              <p className="text-sm uppercase tracking-[0.22em] text-ink-soft">Announcement Board</p>
              <h2 className="mt-5 font-display text-4xl font-bold text-ink sm:text-5xl">
                A new heritage capsule is now available.
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-9 text-ink-soft">
                Discover limited handcrafted accessories inspired by Palestinian symbolism, soft packaging rituals, and warm copper finishes curated for gifting and everyday styling.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <motion.div {...ctaMotionProps}>
                  <Link to="/products" className="inline-flex items-center justify-center rounded-sm bg-white px-8 py-4 font-display text-2xl text-ink shadow-card transition hover:bg-cream">
                    Explore the drop
                  </Link>
                </motion.div>
                <motion.div {...ctaMotionProps}>
                  <Link to="/about" className="inline-flex items-center justify-center rounded-sm border border-white/50 bg-white/40 px-8 py-4 text-base font-semibold text-ink transition hover:bg-white/70">
                    Learn more
                  </Link>
                </motion.div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-shell">
        <Reveal>
          <SectionTitle
            title="Reviews"
            description="Customers can share their Athar experience here. Only logged-in customers can add a review."
            action={
              <motion.div {...ctaMotionProps}>
                <button
                  type="button"
                  onClick={scrollFeedbackDown}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-rose hover:bg-blush"
                >
                  <ScrollIcon />
                  Scroll reviews
                </button>
              </motion.div>
            }
          />
        </Reveal>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <div className="rounded-[28px] bg-white p-6 shadow-card">
              <h3 className="font-display text-3xl text-ink">
                {authUser
                  ? currentUserFeedback
                    ? 'Update your review'
                    : 'Share your review'
                  : 'Please log in to write a review.'}
              </h3>
              <p className="mt-2 text-base leading-7 text-ink-soft">
                {authUser
                  ? 'Write a short review about your Athar experience. You can come back later and update it.'
                  : 'Public visitors can read reviews, but only logged-in customers can add one.'}
              </p>

              {!authUser ? (
                <div className="mt-6 rounded-[24px] border border-line bg-[#fffaf8] px-5 py-5">
                  <p className="text-base font-semibold text-ink">Please log in to write a review.</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    You can still read customer reviews here. Sign in when you want to share your own Athar experience.
                  </p>
                  <motion.div {...ctaMotionProps}>
                    <Link to="/auth" className="button-primary mt-5 inline-flex">
                      Log in to review
                    </Link>
                  </motion.div>
                </div>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleSubmitFeedback}>
                  <textarea
                    value={feedbackForm}
                    onChange={(event) => setFeedbackForm(event.target.value)}
                    placeholder="Write your review here..."
                    rows={6}
                    className="w-full rounded-[24px] border border-line bg-cream px-5 py-4 text-base leading-7 text-ink outline-none transition focus:border-rose"
                    disabled={feedbackSubmitting}
                  />

                  {feedbackError ? (
                    <div className="rounded-2xl border border-rose/20 bg-rose/5 px-4 py-3 text-sm font-medium text-rose">
                      {feedbackError}
                    </div>
                  ) : null}

                  {feedbackSuccess ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                      {feedbackSuccess}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted">
                      {feedbackSuccess || 'Your review will appear for other visitors after a successful save.'}
                    </p>
                    <motion.div {...ctaMotionProps}>
                      <button
                        type="submit"
                        disabled={feedbackSubmitting}
                        className="button-primary"
                      >
                        {feedbackSubmitting
                          ? 'Saving...'
                          : currentUserFeedback
                            ? 'Update review'
                            : 'Add review'}
                      </button>
                    </motion.div>
                  </div>
                </form>
              )}
            </div>
          </Reveal>

          <StaggerContainer
            ref={feedbackListRef}
            className="max-h-[540px] space-y-4 overflow-y-auto rounded-[28px] bg-white p-5 shadow-card"
            amount={0.1}
          >
            {feedbackLoading ? (
              <div className="rounded-[24px] border border-line/70 bg-cream px-5 py-8 text-center text-base text-ink-soft">
                Loading reviews...
              </div>
            ) : null}

            {!feedbackLoading && feedbackLoadError ? (
              <div className="rounded-[24px] border border-rose/20 bg-rose/5 px-5 py-8 text-center text-base font-medium text-rose">
                {feedbackLoadError}
              </div>
            ) : null}

            {!feedbackLoading && !feedbackLoadError && feedbackItems.length === 0 ? (
              <div className="rounded-[24px] border border-line/70 bg-cream px-5 py-8 text-center text-base text-ink-soft">
                No reviews yet.
              </div>
            ) : null}

            {!feedbackLoading && !feedbackLoadError
              ? feedbackItems.map((item) => (
                  <StaggerItem key={item.id}>
                    <FeedbackCard item={item} />
                  </StaggerItem>
                ))
              : null}
          </StaggerContainer>
        </div>
      </section>

      <section className="section-shell">
        <Reveal>
          <div className="flex flex-col items-center justify-between gap-4 rounded-[32px] border border-line bg-white px-6 py-8 text-center shadow-card sm:flex-row sm:text-left">
            <div>
              <h2 className="font-display text-4xl text-ink">Ready to start shopping?</h2>
              <p className="mt-2 text-base text-ink-soft">The page layer is connected through search, cart, checkout, and order tracking.</p>
            </div>
            <motion.div {...ctaMotionProps}>
              <Link to="/products" className="button-primary">
                Start shopping
              </Link>
            </motion.div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default HomePage;
