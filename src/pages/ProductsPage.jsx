import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Reveal from '../components/animation/Reveal';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import Filter from '../components/Filter';
import ProductPromoAd from '../components/ProductPromoAd';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import { getHeritageCityById } from '../data/heritageCities';
import { trackBehavior } from '../utils/behaviorTracking';
import { getCatalogCategories, isProductFavorite } from '../utils/productCatalog';

const PRODUCTS_PER_PAGE = 6;
const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'most-viewed', label: 'Most viewed' },
  { value: 'best-selling', label: 'Best selling' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

const getNumberValue = (product, fields) => {
  for (const field of fields) {
    const value = Number(product?.[field] ?? 0);
    if (Number.isFinite(value)) return value;
  }

  return 0;
};

const getCreatedTime = (product) => {
  const timestamp = Date.parse(product?.createdAt ?? product?.created_at ?? '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortProducts = (productList, sortBy) => {
  const nextProducts = [...productList];

  switch (sortBy) {
    case 'price-asc':
      return nextProducts.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return nextProducts.sort((a, b) => b.price - a.price);
    case 'name-asc':
      return nextProducts.sort((a, b) => a.name.localeCompare(b.name));
    case 'most-viewed':
      return nextProducts.sort((a, b) => getNumberValue(b, ['viewCount', 'views', 'viewsCount']) - getNumberValue(a, ['viewCount', 'views', 'viewsCount']));
    case 'best-selling':
      return nextProducts.sort(
        (a, b) =>
          getNumberValue(b, ['soldCount', 'totalSold', 'salesCount', 'orderCount', 'purchases']) -
          getNumberValue(a, ['soldCount', 'totalSold', 'salesCount', 'orderCount', 'purchases']),
      );
    case 'newest':
      return nextProducts.sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
    case 'oldest':
      return nextProducts.sort((a, b) => getCreatedTime(a) - getCreatedTime(b));
    default:
      return nextProducts.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.rating - a.rating;
      });
  }
};

const ProductsPage = ({ products, favoriteIds, onToggleFavorite, onAddToCart, isLoading = false, errorMessage = '', onRefreshProducts }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = getCatalogCategories(products);
  const query = searchParams.get('q') ?? '';
  const selectedCategory = searchParams.get('category') ?? 'All';
  const minPrice = searchParams.get('min') ?? '';
  const maxPrice = searchParams.get('max') ?? '';
  const sortBy = searchParams.get('sort') ?? 'featured';
  const selectedCityId = searchParams.get('city') ?? '';
  const selectedCity = getHeritageCityById(selectedCityId);
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const lastTrackedSearchRef = useRef('');

  const updateParams = (changes) => {
    const nextParams = new URLSearchParams(searchParams);
    const paginationOnly = Object.keys(changes).length === 1 && Object.prototype.hasOwnProperty.call(changes, 'page');

    Object.entries(changes).forEach(([key, value]) => {
      const shouldDelete =
        value === '' ||
        value === 'All' ||
        (key === 'sort' && value === 'featured') ||
        (key === 'page' && value === '1');

      if (shouldDelete) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    if (!paginationOnly) {
      nextParams.delete('page');
    }

    setSearchParams(nextParams);
  };

  const normalizedQuery = query.trim().toLowerCase();
  const minimumPrice = minPrice ? Number(minPrice) : 0;
  const maximumPrice = maxPrice ? Number(maxPrice) : Number.POSITIVE_INFINITY;

  const filteredProducts = sortProducts(
    products.filter((product) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery) ||
        product.material.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery);

      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchesPrice = product.price >= minimumPrice && product.price <= maximumPrice;
      const matchesCity = !selectedCityId || String(product.inspiredByCity ?? '').toLowerCase() === selectedCityId;
      return matchesSearch && matchesCategory && matchesPrice && matchesCity;
    }),
    sortBy,
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const currentPage = Number.isNaN(rawPage) ? 1 : Math.min(Math.max(rawPage, 1), totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const trackingKey = `${trimmedQuery.toLowerCase()}:${filteredProducts.length}`;

      if (lastTrackedSearchRef.current === trackingKey) {
        return;
      }

      lastTrackedSearchRef.current = trackingKey;
      trackBehavior({
        eventType: 'search',
        searchQuery: trimmedQuery,
        sourcePage: '/products',
        metadata: {
          resultsCount: filteredProducts.length,
        },
      });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [filteredProducts.length, query]);

  const clearFilters = () => setSearchParams({});
  const hasActiveFilters =
    normalizedQuery.length > 0 || selectedCategory !== 'All' || minPrice !== '' || maxPrice !== '' || sortBy !== 'featured' || selectedCityId !== '';
  const shouldShowSkeletons = isLoading && products.length === 0;

  return (
    <div className="section-shell space-y-10 pb-6 pt-8">
      <ProductPromoAd />

      <div className="flex justify-between items-start">
        <SectionTitle title="All products" description="Browse Athar's curated collection of heritage-inspired accessories." />
        {onRefreshProducts && (
          <button
            onClick={onRefreshProducts}
            disabled={isLoading}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-ink-soft hover:border-line hover:bg-blush/60 hover:text-ink transition disabled:opacity-50 mt-2"
            title="Refresh products"
          >
            <svg
              aria-hidden="true"
              className={`h-5 w-5 transition-transform ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            <span className="sr-only">Refresh products</span>
          </button>
        )}
      </div>

      {isLoading ? <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">Loading the latest Athar collection...</div> : null}
      {errorMessage ? <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">{errorMessage} Showing the last available catalog while the collection refreshes.</div> : null}
      {selectedCity ? (
        <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-white px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Heritage collection</p>
            <p className="mt-1 text-base font-semibold text-ink">Showing pieces inspired by {selectedCity.name} / {selectedCity.arabicName}</p>
          </div>
          <button type="button" onClick={() => updateParams({ city: '' })} className="button-secondary w-fit px-5 py-2 text-sm">
            Clear city
          </button>
        </div>
      ) : null}

      <section className="space-y-6 rounded-[32px] bg-white p-5 shadow-soft sm:p-6">
        <SearchBar value={query} onChange={(event) => updateParams({ q: event.target.value })} placeholder="Search products or materials" showButton={false} />
        <Filter
          categories={['All', ...categories.map((category) => category.name)]}
          selectedCategory={selectedCategory}
          onCategoryChange={(category) => updateParams({ category })}
          sortValue={sortBy}
          sortOptions={sortOptions}
          onSortChange={(sort) => updateParams({ sort })}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPriceChange={(min) => updateParams({ min })}
          onMaxPriceChange={(max) => updateParams({ max })}
          summary={`Showing ${paginatedProducts.length} of ${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`}
          onClear={clearFilters}
        />
      </section>

      {shouldShowSkeletons ? (
        <section className="space-y-8" aria-label="Loading products">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: PRODUCTS_PER_PAGE }).map((_, index) => (
              <ProductCardSkeleton key={`product-skeleton-${index}`} />
            ))}
          </div>
        </section>
      ) : filteredProducts.length > 0 ? (
        <section className="space-y-8">
          <StaggerContainer immediate className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProducts.map((product) => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} isFavorite={isProductFavorite(favoriteIds, product)} onToggleFavorite={onToggleFavorite} onAddToCart={onAddToCart} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => updateParams({ page: String(pageNumber) })}
                  className={`inline-flex h-11 w-11 items-center justify-center border text-lg font-display transition ${
                    currentPage === pageNumber ? 'border-ink/25 bg-blush text-ink shadow-card' : 'border-transparent bg-[#f4e7e2] text-ink-soft hover:border-ink/10 hover:text-ink'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : products.length === 0 && !isLoading && !hasActiveFilters ? (
        <Reveal>
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-4xl text-ink">The catalog is temporarily empty.</h3>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-ink-soft">New heritage-inspired pieces will appear here as soon as the collection is refreshed.</p>
          </div>
        </Reveal>
      ) : (
        <Reveal>
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h3 className="font-display text-4xl text-ink">No products match these filters.</h3>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-ink-soft">Try widening the price range, changing the category, or starting again from the full catalog.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={clearFilters} className="button-primary">
                Reset filters
              </button>
              <Link to="/" className="button-secondary">
                Return home
              </Link>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
};

export default ProductsPage;
