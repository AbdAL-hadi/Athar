import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import { resolveApiAssetUrl } from '../utils/api';
import { getCatalogCategories } from '../utils/productCatalog';

const testimonials = [
  {
    name: 'Layan Mustafa',
    avatar: 'design/reviewer-layan.jpeg',
    quote:
      'The accessories are very well-organized and of high quality, with clear and eye-catching details. They truly add a distinctive touch to any look.',
  },
  {
    name: 'Lama Ahmed',
    avatar: 'design/reviewer-lama.jpeg',
    quote:
      'The piece is very nice and looks even neater when worn than in the pictures. Neat work and clear attention to detail.',
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

const HomePage = ({ products, favoriteIds, onToggleFavorite }) => {
  const navigate = useNavigate();
  const categoriesRowRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const categories = getCatalogCategories(products);
  const featuredProducts = products.filter((product) => product.featured).slice(0, 5);

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

  return (
    <div className="space-y-16 pb-6 pt-0">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-blush/80 py-14 sm:py-16 lg:py-20">
        <div className="section-shell relative">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="max-w-xl pt-2 lg:pl-16 lg:pt-12">
              <h1 className="max-w-[10ch] font-display text-5xl font-bold italic leading-[1.08] text-ink sm:text-6xl">
              A touch of heritage made to shine
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

      <section className="section-shell">
        <SectionTitle
          eyebrow="View all"
          title="Featured pieces"
          description="A first selection from the collection, styled around the visual language of the Athar storefront."
          action={
            <Link to="/products" className="text-sm font-semibold text-ink-soft transition hover:text-ink">
              See full catalog
            </Link>
          }
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} isFavorite={favoriteIds.includes(product.id)} onToggleFavorite={onToggleFavorite} />
          ))}
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
          description="Kept as a quiet preview list to stay close to the reference page while preserving the storefront flow."
        />

        <div className="mt-8 divide-y divide-line rounded-[28px] bg-white shadow-card">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
              <img src={resolveApiAssetUrl(testimonial.avatar)} alt={testimonial.name} className="h-16 w-16 rounded-full object-cover" />
              <div>
                <h3 className="font-display text-2xl text-ink">{testimonial.name}</h3>
                <p className="mt-2 text-base leading-7 text-ink-soft">{testimonial.quote}</p>
              </div>
            </article>
          ))}
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
