import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '../components/animation/Reveal';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import ProductCard from '../components/ProductCard';
import SectionTitle from '../components/SectionTitle';
import { getFavoriteProducts } from '../utils/productCatalog';

const FavoritesPage = ({ products, favoriteIds, onToggleFavorite, onAddToCart }) => {
  const { t } = useTranslation();
  const favoriteProducts = getFavoriteProducts(products, favoriteIds);

  return (
    <div className="section-shell space-y-10 pb-6 pt-8">
      <SectionTitle title={t('favorites.title', 'Favorite pieces')} description={t('favorites.description', 'Everything you marked with a heart appears here automatically, so your saved Athar picks stay together.')} />

      {favoriteProducts.length > 0 ? (
        <StaggerContainer immediate className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {favoriteProducts.map((product) => (
            <StaggerItem key={product.id}>
              <ProductCard product={product} isFavorite onToggleFavorite={onToggleFavorite} onAddToCart={onAddToCart} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      ) : (
        <Reveal>
          <div className="rounded-[32px] bg-white px-6 py-12 text-center shadow-soft">
            <h2 className="font-display text-4xl text-ink">{t('favorites.emptyTitle', 'No favorites yet.')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-ink-soft">{t('favorites.emptyDescription', 'Tap the heart on any product card and it will appear here instantly.')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/products" className="button-primary">
                {t('common.browseProducts', 'Browse products')}
              </Link>
              <Link to="/" className="button-secondary">
                {t('common.returnHome', 'Return home')}
              </Link>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
};

export default FavoritesPage;
