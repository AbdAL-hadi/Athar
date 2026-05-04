import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StaggerContainer from '../components/animation/StaggerContainer';
import StaggerItem from '../components/animation/StaggerItem';
import FavoriteButton from '../components/FavoriteButton';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { calculateProductPoints, formatAtharPoints, getCurrentAtharPointsBalance } from '../utils/loyaltyPoints';
import { findProductByReference, isProductFavorite, normalizeProduct } from '../utils/productCatalog';

const getDefaultMedia = (product) => {
  const firstImage = product?.images?.[0];

  if (firstImage) {
    return {
      type: 'image',
      src: resolveApiAssetUrl(firstImage),
      alt: product.name,
    };
  }

  return { type: 'image', src: '', alt: '' };
};

const PRODUCT_COMMENT_MAX_LENGTH = 500;

const ProductDetailsPage = ({
  products,
  onAddToCart,
  favoriteIds,
  onToggleFavorite,
  authUser,
  authToken,
  onOpenTryOn,
  onProductLoaded,
}) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const fallbackProduct = useMemo(() => findProductByReference(products, id), [products, id]);
  const fallbackLookupId = fallbackProduct?.productId || '';
  const [product, setProduct] = useState(fallbackProduct);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(() => getDefaultMedia(fallbackProduct));
  const [quantity, setQuantity] = useState(1);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [visualDescriptionData, setVisualDescriptionData] = useState(null);
  const [visualDescriptionError, setVisualDescriptionError] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [commentItems, setCommentItems] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentRating, setCommentRating] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');
  const [commentError, setCommentError] = useState('');
  const audioRef = useRef(null);
  const speechUtteranceRef = useRef(null);

  const stopSpeechPlayback = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    speechUtteranceRef.current = null;
    setIsAudioPlaying(false);
  };

  const stopAudioPlayback = () => {
    const currentAudio = audioRef.current;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      audioRef.current = null;
    }

    setIsAudioPlaying(false);
    stopSpeechPlayback();
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
      stopAudioPlayback();

      try {
        let response;

        try {
          response = await apiRequest(`/api/products/${encodeURIComponent(id)}`);
        } catch (primaryError) {
          if (primaryError?.status === 404 && fallbackLookupId && fallbackLookupId !== id) {
            response = await apiRequest(`/api/products/${encodeURIComponent(fallbackLookupId)}`);
          } else {
            throw primaryError;
          }
        }

        const normalizedProduct = normalizeProduct(response?.data ?? null, fallbackProduct ?? null);

        if (!isCancelled) {
          setProduct(normalizedProduct);
          setSelectedMedia(getDefaultMedia(normalizedProduct));
          onProductLoaded?.(normalizedProduct);
        }
      } catch (error) {
        if (!isCancelled) {
          if (fallbackProduct) {
            setProduct(fallbackProduct);
            setSelectedMedia(getDefaultMedia(fallbackProduct));
            setLoadError(
              error?.status === 404
                ? ''
                : error.message || 'Unable to refresh this product right now.',
            );
          } else {
            setProduct(null);
            setSelectedMedia(getDefaultMedia(null));
            setLoadError(error.message || 'Unable to load this product right now.');
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
  }, [fallbackLookupId, id]);

  useEffect(() => {
    if (!product?.id) {
      setCommentItems([]);
      return undefined;
    }

    let isCancelled = false;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentError('');

      try {
        const response = await apiRequest(
          `/api/comments/product/${encodeURIComponent(product.id)}`,
        );

        if (!isCancelled) {
          setCommentItems(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (error) {
        if (!isCancelled) {
          setCommentError(error.message || 'We could not load product comments right now.');
        }
      } finally {
        if (!isCancelled) {
          setCommentsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      isCancelled = true;
    };
  }, [product?.id]);

  const buildSpokenProductDescription = () => {
    const visualDescriptions = visualDescriptionData?.inferences?.descriptions?.en ?? {};
    const preferredDescription =
      product.accessibilityDescription ||
      visualDescriptions.long ||
      visualDescriptions.short ||
      product.description ||
      `${product.name} is a ${product.category?.toLowerCase() || 'product'}${product.material ? ` made with ${product.material}` : ''}${product.color ? ` in ${product.color}` : ''}.`;
    const details = [
      product.name,
      product.category ? `Category: ${product.category}.` : '',
      Number.isFinite(Number(product.price)) ? `Price: ${formatCurrency(product.price)}.` : '',
      product.material ? `Material: ${product.material}.` : '',
      product.color ? `Color: ${product.color}.` : '',
      preferredDescription,
      product.stock !== undefined ? `Availability: ${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}.` : '',
    ];

    return details.filter(Boolean).join(' ');
  };

  const handleListen = () => {
    setVisualDescriptionError('');

    if (isAudioPlaying) {
      stopAudioPlayback();
      return;
    }

    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setVisualDescriptionError('Audio reading is not available in your browser right now.');
      return;
    }

    stopAudioPlayback();

    const utterance = new SpeechSynthesisUtterance(buildSpokenProductDescription());
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => {
      speechUtteranceRef.current = null;
      setIsAudioPlaying(false);
    };
    utterance.onerror = () => {
      speechUtteranceRef.current = null;
      setIsAudioPlaying(false);
      setVisualDescriptionError('Audio reading is not available in your browser right now.');
    };

    speechUtteranceRef.current = utterance;
    setIsAudioPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    setCommentError('');
    setCommentMessage('');

    if (!authUser || !authToken) {
      navigate('/auth?mode=register');
      return;
    }

    const normalizedComment = commentText.replace(/\s+/g, ' ').trim();

    if (!normalizedComment) {
      setCommentError('Please write a comment before submitting.');
      return;
    }

    if (normalizedComment.length > PRODUCT_COMMENT_MAX_LENGTH) {
      setCommentError(`Comments must stay under ${PRODUCT_COMMENT_MAX_LENGTH} characters.`);
      return;
    }

    setCommentSubmitting(true);

    try {
      const response = await apiRequest('/api/comments', {
        method: 'POST',
        token: authToken,
        body: {
          productId: product.id,
          text: normalizedComment,
          rating: commentRating || undefined,
        },
      });

      setCommentMessage(response?.message || 'Your comment has been submitted.');
      setCommentText('');
      setCommentRating('');

      if (response?.data?.status === 'approved') {
        const commentsResponse = await apiRequest(
          `/api/comments/product/${encodeURIComponent(product.id)}`,
        );
        setCommentItems(Array.isArray(commentsResponse?.data) ? commentsResponse.data : []);
      }
    } catch (error) {
      if (error?.status === 401) {
        navigate('/auth?mode=register');
        return;
      }

      setCommentError(error.message || 'We could not submit your comment right now.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const relatedProducts = useMemo(
    () => (product ? products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3) : []),
    [products, product],
  );
  const galleryItems = useMemo(
    () => (product ? product.images.map((image, index) => ({ type: 'image', src: image, alt: `${product.name} view ${index + 1}` })) : []),
    [product],
  );
  const patternStoryTarget = product?.patternStory?.slug || product?.patternStoryId || '';

  if (isLoading && !product) {
    return (
      <div className="section-shell pt-14">
        <div className="rounded-[32px] bg-white px-7 py-14 text-center shadow-soft">
          <h1 className="font-display text-5xl text-ink">Loading product</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-ink-soft">Preparing the latest details for this piece.</p>
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

  const unitProductPoints = calculateProductPoints(product);
  const purchasePoints = calculateProductPoints(product, quantity);
  const currentBalance = getCurrentAtharPointsBalance(authUser);
  const projectedBalance = currentBalance + purchasePoints;

  const handleAdd = () => {
    if (product.stock < 1) return;
    const wasAdded = onAddToCart?.(product, quantity);

    if (wasAdded === false) {
      return;
    }

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
            <FavoriteButton active={isProductFavorite(favoriteIds, product)} onClick={() => onToggleFavorite(product)} className="h-11 w-11 shrink-0" />
          </div>
          <h1 className="mt-3 font-display text-5xl font-bold text-ink">{product.name}</h1>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <p className="font-display text-5xl text-ink">{formatCurrency(product.price)}</p>
              {product.compareAt > product.price ? <span className="text-xl text-muted line-through">{formatCurrency(product.compareAt)}</span> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {patternStoryTarget ? (
                <Link
                  to={`/motifs/${patternStoryTarget}?product=${encodeURIComponent(product.id)}`}
                  className="inline-flex min-w-[170px] items-center justify-center rounded-[18px] bg-blush px-6 py-3 text-lg font-semibold text-ink transition hover:bg-rose"
                >
                  View pattern story
                </Link>
              ) : null}
              {!patternStoryTarget && product.motifId ? (
                <Link
                  to={`/motifs/${product.motifId}?product=${encodeURIComponent(product.id)}`}
                  className="inline-flex min-w-[160px] items-center justify-center rounded-[18px] bg-blush px-6 py-3 text-lg font-semibold text-ink transition hover:bg-rose"
                >
                  {product.motifCode || 'Athar'}
                </Link>
              ) : null}
            </div>
          </div>
          {purchasePoints > 0 ? (
            <div className="mt-5 rounded-[24px] border border-[#dfbd79]/50 bg-[#fff7f0] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <p className="text-lg font-semibold leading-8 text-ink">
                You will earn <span className="text-[#8f5f45]">{formatAtharPoints(purchasePoints)}</span> with this purchase.
              </p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">
                {formatAtharPoints(unitProductPoints)} per piece will be added to your Athar balance after checkout.
              </p>
              {authUser ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] bg-white/80 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Current balance</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(currentBalance)}</p>
                  </div>
                  <div className="rounded-[18px] bg-white/80 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">After this order</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatAtharPoints(projectedBalance)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  Log in before checkout to save these points to your Athar balance.
                </p>
              )}
            </div>
          ) : null}
          <div className="mt-8 space-y-4">
            <p className="text-2xl leading-10 text-ink-soft">{product.description}</p>
            <div className="flex flex-wrap items-center gap-3" aria-live="polite">
              <button
                type="button"
                onClick={handleListen}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e6cec6] bg-[#fffaf8] px-5 py-3 text-base font-semibold text-ink transition hover:bg-cream focus:outline-none focus:ring-4 focus:ring-rose/20"
                aria-label={isAudioPlaying ? 'Stop reading the product description' : 'Listen to product description'}
              >
                <span aria-hidden="true">{isAudioPlaying ? '■' : '♪'}</span>
                {isAudioPlaying ? 'Stop reading' : 'Listen to product description'}
              </button>
              {visualDescriptionError ? (
                <span className="text-sm text-[#8c6546]">{visualDescriptionError}</span>
              ) : null}
            </div>
          </div>

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
            {onOpenTryOn ? (
              <button
                type="button"
                onClick={() => onOpenTryOn(product)}
                className="w-full rounded-[24px] border border-line bg-white px-6 py-4 text-xl font-semibold text-ink transition hover:bg-cream"
              >
                AI Try-On
              </button>
            ) : null}
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

      <section className="rounded-[32px] bg-white px-6 py-7 shadow-soft sm:px-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted">Community reviews</p>
            <h2 className="mt-2 font-display text-4xl text-ink">Product comments</h2>
            <p className="mt-3 max-w-2xl text-base leading-8 text-ink-soft">
              Comments are checked before publishing to keep the community respectful. AI-assisted moderation may send uncertain comments for admin review.
            </p>
          </div>
          {!authUser ? (
            <Link to="/auth?mode=register" className="button-primary">
              Log in to comment
            </Link>
          ) : null}
        </div>

        {authUser ? (
          <form onSubmit={handleSubmitComment} className="mt-6 rounded-[28px] border border-line bg-[#fffaf8] p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-ink">Your comment</span>
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  maxLength={PRODUCT_COMMENT_MAX_LENGTH}
                  rows={4}
                  className="w-full rounded-[22px] border border-line bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-rose focus:ring-4 focus:ring-rose/10"
                  placeholder="Share what you liked about this product..."
                  disabled={commentSubmitting}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-ink">Rating</span>
                <select
                  value={commentRating}
                  onChange={(event) => setCommentRating(event.target.value)}
                  className="w-full rounded-[22px] border border-line bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-rose focus:ring-4 focus:ring-rose/10"
                  disabled={commentSubmitting}
                >
                  <option value="">Optional</option>
                  {[5, 4, 3, 2, 1].map((ratingValue) => (
                    <option key={ratingValue} value={ratingValue}>
                      {ratingValue} stars
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {commentText.length}/{PRODUCT_COMMENT_MAX_LENGTH} characters
              </p>
              <button
                type="submit"
                disabled={commentSubmitting}
                className="rounded-[18px] bg-blush px-6 py-3 font-semibold text-ink transition hover:bg-rose disabled:cursor-wait disabled:bg-cream disabled:text-muted"
              >
                {commentSubmitting ? 'Checking comment...' : 'Submit comment'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 space-y-3" aria-live="polite">
          {commentMessage ? (
            <div className="rounded-[20px] border border-[#bdd8bc] bg-[#f1faf0] px-4 py-3 text-sm text-[#2f6a35]">
              {commentMessage}
            </div>
          ) : null}
          {commentError ? (
            <div className="rounded-[20px] border border-[#e7c8c8] bg-[#fff8f6] px-4 py-3 text-sm text-[#8c6546]">
              {commentError}
            </div>
          ) : null}
        </div>

        <div className="mt-7 space-y-4">
          {commentsLoading ? (
            <div className="rounded-[24px] bg-cream px-5 py-5 text-ink-soft">Loading comments...</div>
          ) : null}

          {!commentsLoading && commentItems.length === 0 ? (
            <div className="rounded-[24px] bg-cream px-5 py-5 text-ink-soft">
              No approved comments yet. Be the first to share a respectful note.
            </div>
          ) : null}

          {!commentsLoading
            ? commentItems.map((comment) => (
                <article key={comment.id} className="rounded-[24px] border border-line bg-white px-5 py-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl text-ink">{comment.authorName}</h3>
                      {comment.rating ? (
                        <p className="mt-1 text-sm font-semibold text-rose">
                          {'★'.repeat(comment.rating)}
                          <span className="text-muted">{'★'.repeat(5 - comment.rating)}</span>
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <p className="mt-3 text-base leading-8 text-ink-soft">{comment.text}</p>
                </article>
              ))
            : null}
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section>
          <SectionTitle title="Related products" description="Additional pieces from the same category, kept connected to the reusable logic already in the project." />
          <StaggerContainer immediate className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {relatedProducts.map((relatedProduct) => (
              <StaggerItem key={relatedProduct.id}>
                <ProductCard product={relatedProduct} isFavorite={isProductFavorite(favoriteIds, relatedProduct)} onToggleFavorite={onToggleFavorite} onAddToCart={onAddToCart} />
              </StaggerItem>
            ))}
          </StaggerContainer>
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
