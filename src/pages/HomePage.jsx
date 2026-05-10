import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import Reveal from '../components/animation/Reveal';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';
import { trackBehavior } from '../utils/behaviorTracking';
import { isProductFavorite } from '../utils/productCatalog';
import { getCatalogCategories } from '../utils/productCatalog';

const CTA_EASE = [0.22, 1, 0.36, 1];

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

const StarRating = ({ value = 5, onChange, disabled = false, sizeClass = 'text-lg' }) => {
  const normalizedValue = Math.min(5, Math.max(1, Math.round(Number(value) || 5)));

  return (
    <div className={`inline-flex items-center gap-1 ${sizeClass}`} aria-label={`${normalizedValue} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const isActive = starValue <= normalizedValue;

        if (onChange) {
          return (
            <button
              key={starValue}
              type="button"
              onClick={() => onChange(starValue)}
              disabled={disabled}
              className={`leading-none transition ${isActive ? 'text-[#b88746]' : 'text-[#d7c8bd]'} ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:scale-110 hover:text-[#b88746]'}`}
              aria-label={`Rate ${starValue} star${starValue === 1 ? '' : 's'}`}
            >
              ★
            </button>
          );
        }

        return (
          <span key={starValue} className={isActive ? 'text-[#b88746]' : 'text-[#d7c8bd]'}>
            ★
          </span>
        );
      })}
    </div>
  );
};

const FeedbackCard = ({ item }) => {
  const initial = item?.name?.charAt(0)?.toUpperCase() || 'A';
  const rating = Math.min(5, Math.max(1, Math.round(Number(item?.rating) || 5)));
  const createdAtLabel = item?.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <article className="flex min-h-[350px] flex-col rounded-[6px] bg-white p-6 shadow-[0_20px_48px_rgba(66,47,35,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f7ede6] text-base font-bold text-ink">
              {initial}
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">{item.name}</h3>
              {createdAtLabel ? (
                <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-muted">{createdAtLabel}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            <StarRating value={rating} sizeClass="text-base" />
          </div>
        </div>

        <span className="rounded-full bg-[#fff7f0] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8f5f45]">
          {rating}/5
        </span>
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        <p className="text-lg font-semibold text-ink">Athar experience</p>
        <p className="mt-4 flex-1 text-base leading-8 text-ink-soft">{item.message}</p>

        <div className="mt-8 border-t border-line pt-4">
          <p className="text-sm font-semibold text-ink">Athar Storefront</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
            Site review
          </p>
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
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackLoadError, setFeedbackLoadError] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
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

    if (trimmedQuery) {
      trackBehavior({
        eventType: 'search',
        searchQuery: trimmedQuery,
        sourcePage: '/',
      });
    }

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
    setFeedbackRating(currentUserFeedback?.rating ?? 5);
  }, [currentUserFeedback]);

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

    const normalizedRating = Math.min(5, Math.max(1, Math.round(Number(feedbackRating) || 5)));

    setFeedbackSubmitting(true);

    try {
      const response = await apiRequest('/api/feedback', {
        method: 'POST',
        token: activeToken,
        body: { message: normalizedMessage, rating: normalizedRating },
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
      <section className="relative left-1/2 right-1/2 -mx-[50vw] min-h-[680px] w-screen overflow-hidden bg-[#251913] py-16 sm:py-20 lg:flex lg:min-h-[calc(100vh-92px)] lg:items-center lg:py-24">
        <img
          src={resolveApiAssetUrl('products/homeshorouq.jpeg')}
          alt="Athar Palestinian heritage accessories"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(34,22,17,0.78)_0%,rgba(54,36,28,0.55)_42%,rgba(34,22,17,0.16)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,241,0.08)_0%,rgba(37,25,19,0.18)_100%)]" />
        <div className="section-shell relative z-10">
          <div className="max-w-[620px]">
            <div className="min-w-0 pt-2">
              <Reveal delay={0.12} immediate>
<h1 className="max-w-[560px] overflow-hidden font-display text-[2.75rem] font-semibold leading-[1.16] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.36)] sm:text-[3.35rem] lg:text-[4rem] xl:text-[4.4rem]">
  <span className="block">
    A touch of heritage<span className="font-bold tracking-[0.01em] text-white"></span>
  </span>
  <span className="block">made to shine</span>
</h1>
              </Reveal>
              <Reveal delay={0.22} immediate>
                <p className="mt-6 max-w-[500px] text-base font-semibold leading-8 text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.42)]">
                  At Athar, we create handcrafted accessories that blend timeless heritage with modern elegance through refined copper details and artistic embroidery.
                </p>
              </Reveal>
              <Reveal delay={0.34} immediate>
                <div className="mt-9 flex flex-wrap gap-3">
                  <motion.div {...ctaMotionProps}>
                    <Link
                      to="/products"
                      className="inline-flex min-w-[160px] items-center justify-center bg-white px-6 py-3 text-base font-semibold text-ink shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition hover:bg-cream"
                    >
                      View Collection
                    </Link>
                  </motion.div>
                  <motion.div {...ctaMotionProps}>
                    <Link
                      to="/about"
                      className="inline-flex min-w-[160px] items-center justify-center border border-white/70 bg-white/14 px-6 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-sm transition hover:bg-white/22"
                    >
                      Discover Athar
                    </Link>
                  </motion.div>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal delay={0.52} immediate className="pointer-events-none absolute bottom-2 right-6 hidden opacity-80 lg:block">
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

          <StaggerContainer immediate className="grid gap-6 lg:grid-cols-2 xl:gap-8">
            {featuredProducts.map((product, index) => (
              <StaggerItem key={product.id}>
                <div className="group h-full">
                  <div className="relative h-full transition hover:shadow-2xl">
                    <ProductCard
                      product={product}
                      isFavorite={isProductFavorite(favoriteIds, product)}
                      onToggleFavorite={onToggleFavorite}
                      onAddToCart={onAddToCart}
                      variant="horizontal"
                    />
                    {index < 2 ? (
                      <div className="absolute right-4 top-4 inline-block rounded-full bg-gradient-to-r from-rose to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
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

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-[#f5f3f1] py-20">
        <div className="section-shell">
          <Reveal>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8f5f45]">Reviews</p>
                <h2 className="mt-3 text-5xl font-bold leading-tight text-ink sm:text-6xl">
                  Happy Customers
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-ink-soft">
                  Rate your Athar experience and share a note. New reviews appear here for everyone after saving.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <motion.div {...ctaMotionProps}>
                  <button
                    type="button"
                    onClick={() => feedbackListRef.current?.scrollBy({ left: -420, behavior: 'smooth' })}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-[#d8c7ba] hover:bg-[#fbf4ef]"
                    aria-label="Previous reviews"
                  >
                    <ArrowIcon direction="left" />
                  </button>
                </motion.div>
                <motion.div {...ctaMotionProps}>
                  <button
                    type="button"
                    onClick={() => feedbackListRef.current?.scrollBy({ left: 420, behavior: 'smooth' })}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-[#d8c7ba] hover:bg-[#fbf4ef]"
                    aria-label="Next reviews"
                  >
                    <ArrowIcon />
                  </button>
                </motion.div>
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <Reveal>
              <div className="rounded-[6px] bg-white p-6 shadow-[0_20px_48px_rgba(66,47,35,0.08)]">
                <h3 className="text-2xl font-bold text-ink">
                  {authUser
                    ? currentUserFeedback
                      ? 'Update your review'
                      : 'Share your review'
                    : 'Log in to review'}
                </h3>
                <p className="mt-2 text-sm leading-7 text-ink-soft">
                  {authUser
                    ? 'Choose your rating and write a short comment about your experience with Athar.'
                    : 'Visitors can read reviews. Customers can log in to add a public rating and comment.'}
                </p>

                {!authUser ? (
                  <div className="mt-6 rounded-[6px] border border-line bg-[#fffaf8] px-5 py-5">
                    <p className="text-base font-semibold text-ink">Please log in to write a review.</p>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">
                      Your rating and comment will show in this section for everyone.
                    </p>
                    <motion.div {...ctaMotionProps}>
                      <Link to="/auth" className="button-primary mt-5 inline-flex">
                        Log in to review
                      </Link>
                    </motion.div>
                  </div>
                ) : (
                  <form className="mt-6 space-y-4" onSubmit={handleSubmitFeedback}>
                    <div>
                      <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-muted">Your rating</p>
                      <StarRating
                        value={feedbackRating}
                        onChange={setFeedbackRating}
                        disabled={feedbackSubmitting}
                        sizeClass="text-3xl"
                      />
                    </div>

                    <textarea
                      value={feedbackForm}
                      onChange={(event) => setFeedbackForm(event.target.value)}
                      placeholder="Write your review here..."
                      rows={6}
                      className="w-full rounded-[6px] border border-line bg-[#f8f4f0] px-5 py-4 text-base leading-7 text-ink outline-none transition focus:border-[#b88746] focus:bg-white"
                      disabled={feedbackSubmitting}
                    />

                    {feedbackError ? (
                      <div className="rounded-[6px] border border-rose/20 bg-rose/5 px-4 py-3 text-sm font-medium text-rose">
                        {feedbackError}
                      </div>
                    ) : null}

                    {feedbackSuccess ? (
                      <div className="rounded-[6px] border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                        {feedbackSuccess}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="max-w-[220px] text-xs leading-5 text-muted">
                        {feedbackSuccess || 'Saved reviews appear publicly in Happy Customers.'}
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
              className="flex gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              amount={0.1}
            >
              {feedbackLoading ? (
                <div className="min-w-[360px] rounded-[6px] border border-line/70 bg-white px-5 py-8 text-center text-base text-ink-soft">
                  Loading reviews...
                </div>
              ) : null}

              {!feedbackLoading && feedbackLoadError ? (
                <div className="min-w-[360px] rounded-[6px] border border-rose/20 bg-white px-5 py-8 text-center text-base font-medium text-rose">
                  {feedbackLoadError}
                </div>
              ) : null}

              {!feedbackLoading && !feedbackLoadError && feedbackItems.length === 0 ? (
                <div className="min-w-[360px] rounded-[6px] border border-line/70 bg-white px-5 py-8 text-center text-base text-ink-soft">
                  No reviews yet.
                </div>
              ) : null}

              {!feedbackLoading && !feedbackLoadError
                ? feedbackItems.map((item) => (
                    <StaggerItem key={item.id} className="w-[360px] min-w-[360px] lg:w-[420px] lg:min-w-[420px]">
                      <FeedbackCard item={item} />
                    </StaggerItem>
                  ))
                : null}
            </StaggerContainer>
          </div>
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
