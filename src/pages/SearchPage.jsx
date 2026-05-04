import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Reveal from '../components/animation/Reveal';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import FavoriteButton from '../components/FavoriteButton';
import SearchBar from '../components/SearchBar';
import SectionTitle from '../components/SectionTitle';
import { resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { isProductFavorite } from '../utils/productCatalog';

const SearchPage = ({ products, favoriteIds, onToggleFavorite }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(activeQuery);

  useEffect(() => {
    setInputValue(activeQuery);
  }, [activeQuery]);

  const normalizedQuery = activeQuery.trim().toLowerCase();
  const results = normalizedQuery
    ? products.filter((product) => {
        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.category.toLowerCase().includes(normalizedQuery) ||
          product.material.toLowerCase().includes(normalizedQuery) ||
          product.description.toLowerCase().includes(normalizedQuery)
        );
      })
    : [];

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedQuery = inputValue.trim();
    setSearchParams(trimmedQuery ? { q: trimmedQuery } : {});
  };

  return (
    <div className="section-shell space-y-8 pb-6 pt-8">
      <section className="rounded-[32px] bg-white px-5 py-6 shadow-soft sm:px-6">
        <SectionTitle title="Search for your favorite products" description="This page keeps the URL-driven search logic while following the Athar list view." />
        <SearchBar value={inputValue} onChange={(event) => setInputValue(event.target.value)} onSubmit={handleSubmit} placeholder="Search Athar products" className="mt-6" />
      </section>

      {!activeQuery ? (
        <Reveal>
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h2 className="font-display text-4xl text-ink">Start with a search term.</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-8 text-ink-soft">Try searching for bracelets, wallets, rings, or heritage-inspired accessories.</p>
          </div>
        </Reveal>
      ) : results.length > 0 ? (
        <StaggerContainer immediate className="overflow-hidden rounded-[32px] bg-white shadow-soft">
          {results.map((product) => (
            <StaggerItem key={product.id}>
              <article className="flex items-center gap-4 border-b border-line px-5 py-5 transition hover:bg-cream/70">
                <Link to={`/products/${product.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <img src={resolveApiAssetUrl(product?.images?.[0])} alt={product.name} className="h-12 w-12 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-3xl text-ink">{product.name}</p>
                    <p className="text-sm text-ink-soft">{product.category} · {formatCurrency(product.price)}</p>
                  </div>
                  <span className="hidden rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-cream sm:inline-flex">More Details</span>
                </Link>

                <FavoriteButton active={isProductFavorite(favoriteIds, product)} onClick={() => onToggleFavorite(product)} className="h-10 w-10 shrink-0" />
              </article>
            </StaggerItem>
          ))}
        </StaggerContainer>
      ) : (
        <Reveal>
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h2 className="font-display text-4xl text-ink">No results found.</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-8 text-ink-soft">Nothing matched "{activeQuery}" in the catalog. Try a broader term or return to the full catalog.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setSearchParams({})} className="button-primary">
                Clear search
              </button>
              <Link to="/products" className="button-secondary">
                Browse products
              </Link>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
};

export default SearchPage;
