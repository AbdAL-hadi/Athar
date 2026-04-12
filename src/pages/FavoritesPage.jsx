import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import SectionTitle from '../components/SectionTitle';

const FavoritesPage = ({ products, favoriteIds, onToggleFavorite }) => {
  const favoriteProducts = products.filter((product) => favoriteIds.includes(product.id));

  return (
    <div className="section-shell space-y-10 pb-6 pt-8">
      <SectionTitle title="Favorite pieces" description="Everything you marked with a heart appears here automatically, so your saved Athar picks stay together." />

      {favoriteProducts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {favoriteProducts.map((product) => (
            <ProductCard key={product.id} product={product} isFavorite onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      ) : (
        <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
          <h2 className="font-display text-4xl text-ink">No favorites yet.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-ink-soft">Tap the heart on any product card and it will appear here instantly.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/products" className="button-primary">
              Browse products
            </Link>
            <Link to="/" className="button-secondary">
              Return home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
