import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import { apiRequest } from '../utils/api';
import { getActiveAuthToken } from '../utils/authSession';
import { resolveApiAssetUrl } from '../utils/api';
import { getCatalogCategories } from '../utils/productCatalog';

const starterTestimonials = [
  {
    id: 'starter-layan',
    name: 'Layan Mustafa',
    message:
      'The accessories are very well-organized and of high quality, with clear and eye-catching details. They truly add a distinctive touch to any look.',
    createdAt: '2026-01-14T10:00:00.000Z',
    isStarter: true,
  },
  {
    id: 'starter-lama',
    name: 'Lama Ahmed',
    message:
      'The piece is very nice and looks even neater when worn than in the pictures. Neat work and clear attention to detail.',
    createdAt: '2026-01-07T10:00:00.000Z',
    isStarter: true,
  },
];

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

const HomePage = ({ products, favoriteIds, onToggleFavorite, authUser, authToken }) => {
  const navigate = useNavigate();
  const categoriesRowRef = useRef(null);
  const feedbackListRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackItems, setFeedbackItems] = useState(starterTestimonials);
  const [feedbackForm, setFeedbackForm] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const categories = getCatalogCategories(products);
  const featuredProducts = products.filter((product) => product.featured).slice(0, 5);
  const currentUserFeedback = authUser
    ? feedbackItems.find((item) => item.userId === authUser.id)
    : null;

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
      setFeedbackError('');

      try {
        const activeToken = getActiveAuthToken(authToken);
        const response = await apiRequest('/api/feedback', {
          token: activeToken || undefined,
        });
        const remoteFeedback = Array.isArray(response?.data) ? response.data : [];

        if (!isCancelled) {
          setFeedbackItems(
            remoteFeedback.length > 0
              ? [...remoteFeedback, ...starterTestimonials]
              : starterTestimonials,
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setFeedbackItems(starterTestimonials);
          setFeedbackError(
            error?.message || 'We could not load community feedback right now.',
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
  }, [authToken]);

  useEffect(() => {
    setFeedbackForm(currentUserFeedback?.message ?? '');
  }, [currentUserFeedback]);

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    setFeedbackError('');
    setFeedbackSuccess('');

    if (!authUser) {
      navigate('/auth');
      return;
    }

    const activeToken = getActiveAuthToken(authToken);

    if (!activeToken) {
      navigate('/auth');
      return;
    }

    const normalizedMessage = feedbackForm.replace(/\s+/g, ' ').trim();

    if (normalizedMessage.length < 10) {
      setFeedbackError('Please write at least 10 characters before saving your feedback.');
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
          const starterItems = currentItems.filter((item) => item.isStarter);
          const remoteItems = currentItems.filter(
            (item) => !item.isStarter && item.id !== savedFeedback.id,
          );

          return [savedFeedback, ...remoteItems, ...starterItems];
        });
      }

      setFeedbackSuccess(response?.message || 'Your feedback has been saved.');
      setFeedbackForm(savedFeedback?.message ?? normalizedMessage);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        navigate('/auth');
        return;
      }

      setFeedbackError(
        error?.message || 'We could not save your feedback right now.',
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="space-y-16 pb-6 pt-0">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-blush/80 py-14 sm:py-16 lg:py-20">
        <div className="section-shell relative">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="max-w-xl pt-2 lg:pl-16 lg:pt-12">
              <h1 className="max-w-[9ch] font-body text-[3.05rem] font-black italic leading-[1.04] tracking-[0.015em] text-black sm:text-[3.35rem] lg:text-[3.55rem]">
                <span className="block">A touch of</span>
                <span className="block">heritage</span>
                <span className="block">made to shine</span>
              </h1>
              <p className="mt-7 max-w-md text-lg font-semibold leading-9 text-ink">
                At Athar, we create handcrafted accessories that blend timeless heritage with modern elegance through refined copper details and artistic embroidery.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <Link
                  to="/products"
                  className="inline-flex min-w-[188px] items-center justify-center bg-white px-8 py-4 text-lg font-semibold text-ink shadow-[0_18px_40px_rgba(43,26,20,0.14)] transition hover:-translate-y-0.5"
                >
                  View Collection
                </Link>
                <Link
                  to="/about"
                  className="inline-flex min-w-[188px] items-center justify-center bg-white px-8 py-4 text-lg font-semibold text-ink shadow-[0_18px_40px_rgba(43,26,20,0.14)] transition hover:-translate-y-0.5"
                >
                  Discover Athar
                </Link>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <img
                src={resolveApiAssetUrl('products/atharhome.png')}
                alt="Athar hero collage"
                className="w-full max-w-[520px] object-cover"
              />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-2 right-6 hidden grid-cols-6 gap-3 lg:grid">
            {Array.from({ length: 24 }).map((_, index) => (
              <span key={index} className="h-1 w-1 rounded-full bg-[#cbb7b0]" />
            ))}
          </div>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-gradient-to-b from-white via-blush/30 to-cream py-20">
        <div className="section-shell">
          <div className="mb-16">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose mb-3">✨ View all</p>
                <h2 className="font-display text-5xl font-bold text-ink sm:text-6xl mb-4">
                  Featured Pieces
                </h2>
                <p className="max-w-2xl text-lg leading-8 text-ink-soft font-medium">
                  A first selection from the collection, styled around the visual language of the Athar storefront. Discover our handpicked favorites.
                </p>
              </div>
              <Link to="/products" className="inline-flex items-center gap-2 rounded-full bg-rose px-6 py-3 font-semibold text-white transition hover:bg-rose/90 hover:shadow-lg">
                See full catalog →
              </Link>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10 xl:grid-cols-4 2xl:grid-cols-5">
            {featuredProducts.map((product, index) => (
              <div key={product.id} className="group transform transition hover:scale-105">
                <div className="relative h-full rounded-3xl bg-white shadow-lg transition hover:shadow-2xl">
                  <ProductCard 
                    product={product} 
                    isFavorite={favoriteIds.includes(product.id)} 
                    onToggleFavorite={onToggleFavorite} 
                  />
                  {index < 2 && (
                    <div className="absolute top-4 right-4 inline-block rounded-full bg-gradient-to-r from-rose to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
                      🔥 Popular
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg text-ink-soft font-medium">
              ⭐ Curated with care • 🛍️ Premium quality • 💚 Customer favorites
            </p>
          </div>
        </div>
      </section>

      <section className="bg-blush/70 py-8">
        <div className="section-shell">
          <SearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onSubmit={handleSearch}
            placeholder="Search for accessories"
            buttonVariant="secondary"
            inputClassName="bg-white"
            buttonClassName="bg-white"
          />
        </div>
      </section>

      <section className="section-shell">
        <SectionTitle
          title="Sections"
          description="Image-led category discovery designed to stay simple, elegant, and easy to scan."
        />

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => scrollCategories('left')} className="icon-button" aria-label="Scroll sections left">
              <ArrowIcon direction="left" />
            </button>
            <button type="button" onClick={() => scrollCategories('right')} className="icon-button" aria-label="Scroll sections right">
              <ArrowIcon direction="right" />
            </button>
          </div>

          <div ref={categoriesRowRef} className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => (
              <Link key={category.name} to={`/products?category=${encodeURIComponent(category.name)}`} className="group w-[260px] min-w-[260px] rounded-[28px] bg-white p-3 shadow-card transition hover:-translate-y-1 sm:w-[280px] sm:min-w-[280px]">
                <img src={category.image} alt={category.name} className="aspect-[4/4.5] w-full rounded-[22px] object-cover" />
                <div className="mt-4 flex items-center justify-between gap-3 px-2 pb-2">
                  <span className="font-display text-2xl text-ink">{category.name}</span>
                  <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-ink-soft">{category.count}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
        <img
          src={resolveApiAssetUrl('products/freegift.jpg')}
          alt="Free gift with every order"
          className="w-full object-cover"
        />
      </section>

      <section className="bg-blush/80 py-20 sm:py-24">
        <div className="section-shell">
          <div className="rounded-[36px] bg-white/60 p-6 text-center shadow-soft backdrop-blur sm:p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-ink-soft">Announcement Board</p>
            <h2 className="mt-5 font-display text-4xl font-bold text-ink sm:text-5xl">
              A new heritage capsule is now available.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-9 text-ink-soft">
              Discover limited handcrafted accessories inspired by Palestinian symbolism, soft packaging rituals, and warm copper finishes curated for gifting and everyday styling.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/products" className="inline-flex items-center justify-center rounded-sm bg-white px-8 py-4 font-display text-2xl text-ink shadow-card transition hover:-translate-y-0.5 hover:bg-cream">
                Explore the drop
              </Link>
              <Link to="/about" className="inline-flex items-center justify-center rounded-sm border border-white/50 bg-white/40 px-8 py-4 text-base font-semibold text-ink transition hover:bg-white/70">
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <SectionTitle
          title="Feedback"
          description="Customers can leave a comment here, and everyone sees the latest feedback in one scrollable place."
          action={
            <button
              type="button"
              onClick={scrollFeedbackDown}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-rose hover:bg-blush"
            >
              <ScrollIcon />
              Scroll comments
            </button>
          }
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-card">
            <h3 className="font-display text-3xl text-ink">
              {currentUserFeedback ? 'Update your feedback' : 'Share your feedback'}
            </h3>
            <p className="mt-2 text-base leading-7 text-ink-soft">
              {authUser
                ? 'Write a short comment about your Athar experience. You can come back later and update it.'
                : 'Log in with your customer account to publish your own feedback.'}
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmitFeedback}>
              <textarea
                value={feedbackForm}
                onChange={(event) => setFeedbackForm(event.target.value)}
                placeholder="Write your feedback here..."
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
                  {feedbackSuccess
                    ? feedbackSuccess
                    : authUser
                      ? 'Your comment will appear for other visitors after a successful save.'
                      : 'You will be redirected to log in before posting.'}
                </p>
                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="button-primary"
                >
                  {feedbackSubmitting
                    ? 'Saving...'
                    : currentUserFeedback
                      ? 'Update feedback'
                      : 'Add feedback'}
                </button>
              </div>
            </form>
          </div>

          <div
            ref={feedbackListRef}
            className="max-h-[540px] space-y-4 overflow-y-auto rounded-[28px] bg-white p-5 shadow-card"
          >
            {feedbackLoading ? (
              <div className="rounded-[24px] border border-line/70 bg-cream px-5 py-8 text-center text-base text-ink-soft">
                Loading feedback...
              </div>
            ) : null}

            {!feedbackLoading && feedbackItems.length === 0 ? (
              <div className="rounded-[24px] border border-line/70 bg-cream px-5 py-8 text-center text-base text-ink-soft">
                No feedback has been shared yet.
              </div>
            ) : null}

            {!feedbackLoading
              ? feedbackItems.map((item) => <FeedbackCard key={item.id} item={item} />)
              : null}
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="flex flex-col items-center justify-between gap-4 rounded-[32px] border border-line bg-white px-6 py-8 text-center shadow-card sm:flex-row sm:text-left">
          <div>
            <h2 className="font-display text-4xl text-ink">Ready to start shopping?</h2>
            <p className="mt-2 text-base text-ink-soft">The page layer is connected through search, cart, checkout, and order tracking.</p>
          </div>
          <Link to="/products" className="button-primary">
            Start shopping
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
