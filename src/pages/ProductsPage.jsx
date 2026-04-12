import { Link, useSearchParams } from 'react-router-dom';
import Filter from '../components/Filter';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import { getCatalogCategories } from '../utils/productCatalog';

const PRODUCTS_PER_PAGE = 6;
const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A to Z' },
];

const sortProducts = (productList, sortBy) => {
  const nextProducts = [...productList];

  switch (sortBy) {
    case 'price-asc':
      return nextProducts.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return nextProducts.sort((a, b) => b.price - a.price);
    case 'name-asc':
      return nextProducts.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return nextProducts.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.rating - a.rating;
      });
  }
};

const ProductsPage = ({ products, favoriteIds, onToggleFavorite, isLoading = false, errorMessage = '' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = getCatalogCategories(products);
  const query = searchParams.get('q') ?? '';
  const selectedCategory = searchParams.get('category') ?? 'All';
  const minPrice = searchParams.get('min') ?? '';
  const maxPrice = searchParams.get('max') ?? '';
  const sortBy = searchParams.get('sort') ?? 'featured';
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);

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
      return matchesSearch && matchesCategory && matchesPrice;
    }),
    sortBy,
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const currentPage = Number.isNaN(rawPage) ? 1 : Math.min(Math.max(rawPage, 1), totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const clearFilters = () => setSearchParams({});
  const hasActiveFilters =
    normalizedQuery.length > 0 || selectedCategory !== 'All' || minPrice !== '' || maxPrice !== '' || sortBy !== 'featured';

  return (
    <div className="section-shell space-y-10 pb-6 pt-8">
      <SectionTitle title="All products" description="The gallery syncs with the live Athar products API while preserving the premium catalog layout." />

      {isLoading ? <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">Loading the latest collection from the Athar API...</div> : null}
      {errorMessage ? <div className="rounded-[24px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">{errorMessage} Showing the last available catalog while the connection is restored.</div> : null}

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

      {filteredProducts.length > 0 ? (
        <section className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} isFavorite={favoriteIds.includes(product.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>

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
        <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
          <h3 className="font-display text-4xl text-ink">The catalog is temporarily empty.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-ink-soft">Once the Athar products API is available again, the collection will appear here automatically.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default ProductsPage;
