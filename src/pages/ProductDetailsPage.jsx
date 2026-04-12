import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { findProductByReference, normalizeProduct } from '../utils/productCatalog';

const getDefaultMedia = (product) => {
  const firstImage = product?.images?.[0];
  const firstVideo = product?.videos?.[0];

  if (firstImage) {
    return { type: 'image', src: firstImage, alt: product.name };
  }

  if (firstVideo) {
    return { type: 'video', src: firstVideo, alt: `${product.name} video`, poster: product?.images?.[0] ?? '' };
  }

  return { type: 'image', src: '', alt: '' };
};

const ProductDetailsPage = ({ products, onAddToCart, favoriteIds, onToggleFavorite }) => {
  const { id } = useParams();
  const fallbackProduct = findProductByReference(products, id);
  const [product, setProduct] = useState(fallbackProduct);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(() => getDefaultMedia(fallbackProduct));
  const [quantity, setQuantity] = useState(1);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const loadProduct = async () => {
      setIsLoading(true);
      setLoadError('');
      setProduct(fallbackProduct ?? null);
      setSelectedMedia(getDefaultMedia(fallbackProduct));
      setQuantity(1);
      setFeedbackMessage('');

      try {
        const response = await apiRequest(`/api/products/${encodeURIComponent(id)}`);
        const normalizedProduct = normalizeProduct(response?.data ?? null, fallbackProduct ?? null);

        if (!isCancelled) {
          setProduct(normalizedProduct);
          setSelectedMedia(getDefaultMedia(normalizedProduct));
        }
      } catch (error) {
        if (!isCancelled) {
          if (fallbackProduct) {
            setProduct(fallbackProduct);
            setSelectedMedia(getDefaultMedia(fallbackProduct));
            setLoadError(error.message || 'Unable to refresh this product from the Athar API right now.');
          } else {
            setProduct(null);
            setSelectedMedia(getDefaultMedia(null));
            setLoadError(error.message || 'Unable to load this product from the Athar API.');
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      isCancelled = true;
    };
  }, [fallbackProduct, id]);

  if (isLoading && !product) {
    return (
      <div className="section-shell pt-14">
        <div className="rounded-[32px] bg-white px-7 py-14 text-center shadow-soft">
          <h1 className="font-display text-5xl text-ink">Loading product</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-ink-soft">Fetching the latest product details from the Athar API.</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="section-shell pt-14">
        <div className="rounded-[32px] bg-white px-7 py-14 text-center shadow-soft">
          <h1 className="font-display text-5xl text-ink">Product not found</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-ink-soft">{loadError || 'The product you requested is not available in the current catalog.'}</p>
          <Link to="/products" className="button-primary mt-8">
            Browse all products
          </Link>
        </div>
      </div>
    );
  }

  const relatedProducts = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3);
  const galleryItems = [
    ...product.images.map((image, index) => ({ type: 'image', src: image, alt: `${product.name} view ${index + 1}` })),
    ...(product.videos ?? []).map((video, index) => ({ type: 'video', src: video, alt: `${product.name} video ${index + 1}`, poster: product.images[0] ?? '' })),
  ];

  const handleAdd = () => {
    if (product.stock < 1) return;
    onAddToCart(product, quantity);
    setFeedbackMessage(`${quantity} item${quantity > 1 ? 's' : ''} added to cart.`);
  };

  return (
    <div className="section-shell space-y-16 pb-6 pt-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-start">
        <div className="space-y-4 rounded-[32px] bg-white p-4 shadow-soft">
          {isLoading ? <div className="rounded-[18px] bg-cream px-4 py-3 text-sm text-ink-soft">Loading the latest product details...</div> : null}
          {selectedMedia.type === 'video' ? (
            <video key={selectedMedia.src} src={selectedMedia.src} poster={selectedMedia.poster} controls autoPlay muted loop playsInline className="h-[420px] w-full rounded-[26px] object-cover sm:h-[560px]" />
          ) : (
            <img src={selectedMedia.src} alt={selectedMedia.alt || product.name} className="h-[420px] w-full rounded-[26px] object-cover sm:h-[560px]" />
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galleryItems.map((item, index) => (
              <button
                key={`${product.id}-${item.type}-${index}`}
                type="button"
                onClick={() => setSelectedMedia(item)}
                className={`overflow-hidden rounded-[20px] border-2 transition ${
                  selectedMedia.type === item.type && selectedMedia.src === item.src ? 'border-rose' : 'border-transparent'
                }`}
              >
                {item.type === 'video' ? (
                  <div className="relative">
                    <video src={item.src} poster={item.poster} muted playsInline preload="metadata" className="h-24 w-full object-cover sm:h-28" />
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/10">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink">Video</span>
                    </div>
                  </div>
                ) : (
                  <img src={item.src} alt={item.alt} className="h-24 w-full object-cover sm:h-28" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] bg-white px-6 py-7 shadow-soft sm:px-8">
          {loadError ? <div className="rounded-[22px] border border-[#e7c8c8] bg-[#fff8f6] px-4 py-3 text-sm text-[#8c6546]">{loadError}</div> : null}
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.18em] text-muted">{product.category}</p>
            <FavoriteButton active={favoriteIds.includes(product.id)} onClick={() => onToggleFavorite(product.id)} className="h-11 w-11 shrink-0" />
          </div>
          <h1 className="mt-3 font-display text-5xl font-bold text-ink">{product.name}</h1>
          <div className="mt-5 flex items-center gap-4">
            <p className="font-display text-5xl text-ink">{formatCurrency(product.price)}</p>
            {product.compareAt > product.price ? <span className="text-xl text-muted line-through">{formatCurrency(product.compareAt)}</span> : null}
          </div>
          <p className="mt-8 text-2xl leading-10 text-ink-soft">{product.description}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] bg-cream px-5 py-4">
              <p className="text-sm text-muted">Material</p>
              <p className="mt-1 text-lg text-ink">{product.material}</p>
            </div>
            <div className="rounded-[24px] bg-cream px-5 py-4">
              <p className="text-sm text-muted">Availability</p>
              <p className="mt-1 text-lg text-ink">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-5">
            <QuantitySelector value={quantity} onChange={setQuantity} max={product.stock > 0 ? product.stock : 1} className="w-fit" />
            <button
              type="button"
              onClick={handleAdd}
              disabled={product.stock < 1}
              className={`w-full rounded-[24px] px-6 py-4 text-2xl font-semibold transition ${
                product.stock < 1 ? 'cursor-not-allowed bg-cream text-muted' : 'bg-blush text-ink hover:bg-rose'
              }`}
            >
              Order now
            </button>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section>
          <SectionTitle title="Related products" description="Additional pieces from the same category, kept connected to the reusable logic already in the project." />
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} isFavorite={favoriteIds.includes(relatedProduct.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        </section>
      ) : null}

      <Toast
        open={Boolean(feedbackMessage)}
        variant="success"
        title="Added to cart"
        message={feedbackMessage}
        onClose={() => setFeedbackMessage('')}
        action={
          <Link to="/cart" className="button-ghost px-0 py-0 text-sm text-ink">
            View cart
          </Link>
        }
      />
    </div>
  );
};

export default ProductDetailsPage;
