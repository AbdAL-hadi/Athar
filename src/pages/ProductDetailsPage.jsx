import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { findProductByReference, normalizeProduct } from '../utils/productCatalog';

const getDefaultMedia = (product) => {
  const firstImage = product?.images?.[0];

  if (firstImage) {
    return { type: 'image', src: firstImage, alt: product.name };
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
  const [visualDescriptionData, setVisualDescriptionData] = useState(null);
  const [visualDescriptionError, setVisualDescriptionError] = useState('');
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [activeAudioLevel, setActiveAudioLevel] = useState('');
  const [pendingAudioLevel, setPendingAudioLevel] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef(null);

  const stopAudioPlayback = () => {
    const currentAudio = audioRef.current;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      audioRef.current = null;
    }

    setIsAudioPlaying(false);
    setActiveAudioLevel('');
  };

  useEffect(() => {
    let isCancelled = false;

    const loadProduct = async () => {
      setIsLoading(true);
      setLoadError('');
      setProduct(fallbackProduct ?? null);
      setSelectedMedia(getDefaultMedia(fallbackProduct));
      setQuantity(1);
      setFeedbackMessage('');
      setVisualDescriptionData(null);
      setVisualDescriptionError('');
      setPendingAudioLevel('');
      stopAudioPlayback();

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
      stopAudioPlayback();
    };
  }, [fallbackProduct, id]);

  useEffect(() => {
    if (!product?.id) {
      return undefined;
    }

    let isCancelled = false;

    const loadVisualDescription = async () => {
      try {
        const response = await apiRequest(`/api/products/${encodeURIComponent(product.id)}/visual-description`);

        if (!isCancelled) {
          setVisualDescriptionData(response?.data ?? null);
        }
      } catch (error) {
        if (!isCancelled && error?.status !== 404) {
          setVisualDescriptionError(error.message || 'Description unavailable right now.');
        }
      }
    };

    loadVisualDescription();

    return () => {
      isCancelled = true;
    };
  }, [product?.id]);

  const startAudioPlayback = (audioUrl, detailLevel) => {
    const resolvedAudioUrl = resolveApiAssetUrl(audioUrl);

    if (!resolvedAudioUrl) {
      throw new Error('No playable audio file was returned by the server.');
    }

    stopAudioPlayback();

    const nextAudio = new Audio(resolvedAudioUrl);
    nextAudio.onended = () => {
      setIsAudioPlaying(false);
      setActiveAudioLevel('');
      audioRef.current = null;
    };
    nextAudio.onerror = () => {
      setIsAudioPlaying(false);
      setActiveAudioLevel('');
      setVisualDescriptionError('Audio playback is not available in your browser right now.');
      audioRef.current = null;
    };

    audioRef.current = nextAudio;
    setActiveAudioLevel(detailLevel);

    return nextAudio.play().then(() => {
      setIsAudioPlaying(true);
    });
  };

  const handleListen = async (detailLevel) => {
    setIsPreparingAudio(true);
    setPendingAudioLevel(detailLevel);
    setVisualDescriptionError('');

    try {
      const response = await apiRequest(`/api/products/${encodeURIComponent(product.id)}/generate-visual-audio`, {
        method: 'POST',
        body: {
          detailLevel,
          language: 'en',
        },
      });
      const nextVisualDescription = response?.data?.visualDescription ?? null;

      if (nextVisualDescription) {
        setVisualDescriptionData(nextVisualDescription);
      }

      await startAudioPlayback(
        response?.data?.audioUrl,
        response?.data?.detailLevel || detailLevel,
      );
    } catch (error) {
      setVisualDescriptionError(error.message || 'Description unavailable right now.');
    } finally {
      setIsPreparingAudio(false);
      setPendingAudioLevel('');
    }
  };

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
  const galleryItems = product.images.map((image, index) => ({ type: 'image', src: image, alt: `${product.name} view ${index + 1}` }));

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
          <img src={selectedMedia.src} alt={selectedMedia.alt || product.name} className="h-[420px] w-full rounded-[26px] object-cover sm:h-[560px]" />
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
                <img src={item.src} alt={item.alt} className="h-24 w-full object-cover sm:h-28" />
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
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <p className="font-display text-5xl text-ink">{formatCurrency(product.price)}</p>
              {product.compareAt > product.price ? <span className="text-xl text-muted line-through">{formatCurrency(product.compareAt)}</span> : null}
            </div>
            {product.motifId ? (
              <Link
                to={`/motifs/${product.motifId}?product=${encodeURIComponent(product.id)}`}
                className="inline-flex min-w-[160px] items-center justify-center rounded-[18px] bg-blush px-6 py-3 text-lg font-semibold text-ink transition hover:bg-rose"
              >
                {product.motifCode || 'Athar'}
              </Link>
            ) : null}
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

          <div className="mt-8 rounded-[28px] border border-[#ead8d2] bg-[#fffaf8] px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h2 className="font-display text-3xl text-ink">AI visual describer</h2>
                <p className="max-w-2xl text-base leading-8 text-ink-soft">
                  A local accessibility feature for blind and low-vision visitors. It can read a short product description aloud, then continue with more detail if needed.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleListen('short')}
                  disabled={isPreparingAudio}
                  className="rounded-[18px] bg-blush px-5 py-3 text-base font-semibold text-ink transition hover:bg-rose disabled:cursor-wait disabled:bg-cream disabled:text-muted"
                  aria-label="Listen to the short product description"
                >
                  {isPreparingAudio && pendingAudioLevel === 'short' ? 'Preparing audio...' : 'Listen to product description'}
                </button>
                <button
                  type="button"
                  onClick={() => handleListen('long')}
                  disabled={isPreparingAudio}
                  className="rounded-[18px] border border-[#e6cec6] bg-white px-5 py-3 text-base font-semibold text-ink transition hover:bg-cream disabled:cursor-wait disabled:bg-[#faf4f2] disabled:text-muted"
                  aria-label="Listen to the detailed product description"
                >
                  {isPreparingAudio && pendingAudioLevel === 'long' ? 'Preparing audio...' : 'More details'}
                </button>
                <button
                  type="button"
                  onClick={stopAudioPlayback}
                  disabled={!isAudioPlaying}
                  className="rounded-[18px] border border-[#e6cec6] bg-white px-5 py-3 text-base font-semibold text-ink transition hover:bg-cream disabled:cursor-not-allowed disabled:text-muted"
                  aria-label="Stop the spoken product description"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3" aria-live="polite">
              {visualDescriptionData?.inferences?.descriptions?.en?.short ? (
                <div className="rounded-[20px] bg-white px-4 py-4 text-base leading-8 text-ink-soft">
                  <p className="text-sm uppercase tracking-[0.18em] text-muted">Short description</p>
                  <p className="mt-2">{visualDescriptionData.inferences.descriptions.en.short}</p>
                </div>
              ) : null}

              {visualDescriptionData?.needsRefresh ? (
                <p className="text-sm text-[#8c6546]">
                  The stored description looks stale because the product details changed. The listen buttons can regenerate it on demand.
                </p>
              ) : null}

              {visualDescriptionError ? (
                <div className="rounded-[20px] border border-[#e7c8c8] bg-[#fff8f6] px-4 py-3 text-sm text-[#8c6546]">
                  {visualDescriptionError}
                </div>
              ) : null}

              {!visualDescriptionError && !visualDescriptionData?.inferences?.descriptions?.en?.short ? (
                <p className="text-sm text-muted">Description unavailable right now. You can still try the listen button to prepare it on demand.</p>
              ) : null}
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
