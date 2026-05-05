import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL, apiRequest, resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';

const acceptedImageTypes = 'image/png,image/jpeg,image/webp';

const VisualProductMatchPage = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [matchResult, setMatchResult] = useState(null);
  const [noMatchMessage, setNoMatchMessage] = useState('');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setMatchResult(null);
    setNoMatchMessage('');
    setErrorMessage('');
    setImageLoadFailed(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Please upload an image before searching for a match.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setMatchResult(null);
    setNoMatchMessage('');
    setImageLoadFailed(false);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await apiRequest('/api/product-match', {
        method: 'POST',
        body: formData,
      });

      if (response?.available) {
        setMatchResult({
          available: true,
          score: Number(response?.data?.score || 0),
          reason: String(response?.data?.reason || '').trim(),
          analyzedImage: response?.data?.analyzedImage ?? null,
          product: response?.data?.product ?? null,
        });
        return;
      }

      setMatchResult({
        available: false,
        analyzedImage: response?.analyzedImage ?? null,
      });
      setNoMatchMessage(response?.message || 'Sorry, we could not find a similar product currently available in Athar.');
    } catch (error) {
      setErrorMessage(
        error?.message || 'We could not find a match right now. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const matchedProduct = matchResult?.available ? matchResult?.product : null;
  const productHref = matchedProduct ? `/products/${matchedProduct.slug || matchedProduct.id}` : '/products';
  const resolvedProductImage = (() => {
    const imageValue = String(matchedProduct?.image ?? '').trim();

    if (!imageValue) {
      return '';
    }

    const helperResolvedUrl = resolveApiAssetUrl(imageValue);

    if (helperResolvedUrl) {
      return helperResolvedUrl;
    }

    if (/^(?:https?:)?\/\//i.test(imageValue) || imageValue.startsWith('data:') || imageValue.startsWith('blob:')) {
      return imageValue;
    }

    if (imageValue.startsWith('/')) {
      return `${API_BASE_URL}${imageValue}`;
    }

    return `${API_BASE_URL}/${imageValue.replace(/^\/+/, '')}`;
  })();
  const analysisBadges = matchResult?.analyzedImage
    ? [
        matchResult.analyzedImage.productType,
        matchResult.analyzedImage.category,
        ...(Array.isArray(matchResult.analyzedImage.colors) ? matchResult.analyzedImage.colors.slice(0, 2) : []),
        ...(Array.isArray(matchResult.analyzedImage.materials) ? matchResult.analyzedImage.materials.slice(0, 1) : []),
      ]
        .map((value) => String(value ?? '').trim())
        .filter((value) => value && value !== 'unknown')
    : [];

  return (
    <div className="section-shell space-y-8 pb-10 pt-8">
      <section className="heritage-surface overflow-hidden rounded-[36px] border px-6 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <span className="heritage-pill">Visual Product Match</span>
            <h1 className="mt-5 font-display text-4xl text-ink sm:text-5xl">
              Find a Similar Athar Product
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
              Upload a photo of an item you like, and Athar will search for the closest match in our collection.
            </p>
          </div>

          <div className="heritage-panel rounded-[28px] px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">How it works</p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-ink-soft sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[22px] bg-white/80 px-4 py-4">1. Upload one clear product photo.</div>
              <div className="rounded-[22px] bg-white/80 px-4 py-4">2. Athar checks visible colors, materials, and style.</div>
              <div className="rounded-[22px] bg-white/80 px-4 py-4">3. We show the closest available item from the catalog.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.02fr]">
        <section className="heritage-panel rounded-[32px] p-5 sm:p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Upload image</p>
              <h2 className="mt-2 font-display text-3xl text-ink">Reference item</h2>
            </div>

            <label
              htmlFor="visual-product-match-image"
              className="flex min-h-[20rem] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[#cba989] bg-[#fff8f4] px-6 py-8 text-center transition hover:border-[#b88746] hover:bg-[#fff4ee]"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Uploaded preview"
                  className="h-full max-h-[24rem] w-full rounded-[22px] object-cover shadow-soft"
                />
              ) : (
                <div className="max-w-md">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#8f5f45] shadow-card">
                    <svg
                      aria-hidden="true"
                      className="h-7 w-7"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4.5 8.5h3l1.2-2h6.6l1.2 2h3A1.5 1.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 4 17v-7A1.5 1.5 0 0 1 5.5 8.5Z" />
                      <circle cx="12" cy="13" r="3.25" />
                    </svg>
                  </div>
                  <p className="mt-5 text-lg font-semibold text-ink">Choose a reference image</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    JPG, PNG, or WEBP. Max 5MB.
                  </p>
                </div>
              )}
            </label>

            <input
              id="visual-product-match-image"
              type="file"
              accept={acceptedImageTypes}
              className="sr-only"
              onChange={handleFileChange}
            />

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="button-primary" disabled={!selectedFile || isLoading}>
                {isLoading ? 'Analyzing your image...' : 'Find Similar Product'}
              </button>
              <label htmlFor="visual-product-match-image" className="button-secondary cursor-pointer">
                Upload Image
              </label>
            </div>

            <div className="rounded-[22px] bg-white/70 px-4 py-4 text-sm leading-6 text-ink-soft">
              Focus on the item itself rather than the background. One main product in the frame works best.
            </div>

            {errorMessage ? (
              <div className="rounded-[22px] border border-[#e7c8c8] bg-white px-4 py-3 text-sm text-[#8c6546]">
                {errorMessage}
              </div>
            ) : null}
          </form>
        </section>

        <section className="heritage-panel rounded-[32px] p-5 sm:p-6">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Athar suggestion</p>
                <h2 className="mt-2 font-display text-3xl text-ink">Match result</h2>
              </div>

              {matchResult?.available ? (
                <div className="rounded-full bg-[#f4e4d4] px-4 py-2 text-sm font-semibold text-[#8f5f45]">
                  {Math.round((Number(matchResult?.score || 0) || 0) * 100)}% match
                </div>
              ) : null}
            </div>

            {!matchResult && !isLoading ? (
              <div className="mt-6 flex flex-1 items-center justify-center rounded-[28px] border border-line bg-white/70 px-6 py-10 text-center">
                <p className="max-w-sm text-base leading-7 text-ink-soft">
                  Upload a product image and Athar will look for the closest piece in the collection.
                </p>
              </div>
            ) : null}

            {isLoading ? (
              <div className="mt-6 flex flex-1 items-center justify-center rounded-[28px] border border-line bg-white/70 px-6 py-10 text-center">
                <div>
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#d9b7a4] border-t-[#8f5f45]" />
                  <p className="mt-4 text-base text-ink-soft">
                    Athar is reviewing the image and comparing it with the catalog.
                  </p>
                </div>
              </div>
            ) : null}

            {matchResult?.available && matchedProduct ? (
              <div className="mt-6 flex flex-1 flex-col rounded-[28px] bg-white p-4 shadow-card transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(120,84,60,0.18)]">
                {resolvedProductImage && !imageLoadFailed ? (
                  <img
                    src={resolvedProductImage}
                    alt={matchedProduct.title || 'Matched Athar product'}
                    className="aspect-[4/3] w-full rounded-[22px] object-cover"
                    onError={() => setImageLoadFailed(true)}
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[22px] bg-[#f8eee7] px-6 text-center text-sm leading-6 text-ink-soft">
                    Product image unavailable
                  </div>
                )}

                <div className="mt-5 flex flex-1 flex-col">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                    Similarity: {Math.round((Number(matchResult?.score || 0) || 0) * 100)}%
                  </p>
                  <p className="text-sm uppercase tracking-[0.16em] text-muted">{matchedProduct.category}</p>
                  <h3 className="mt-2 font-display text-3xl text-ink">{matchedProduct.title}</h3>
                  <p className="mt-4 font-display text-3xl text-ink">{formatCurrency(matchedProduct.price)}</p>
                  <p className="mt-4 text-base leading-7 text-ink-soft">{matchResult.reason}</p>

                  {analysisBadges.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {analysisBadges.map((badge, index) => (
                        <span
                          key={`${badge}-${index}`}
                          className="rounded-full bg-[#f8eee7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f5f45]"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-ink-soft">
                      {matchedProduct.stock > 0 ? `${matchedProduct.stock} in stock` : 'Currently out of stock'}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(productHref)}
                      className="button-primary shadow-[0_16px_28px_rgba(183,123,111,0.22)]"
                    >
                      View Product
                    </button>
                    <Link to="/products" className="button-secondary">
                      Browse Collection
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {matchResult && !matchResult.available ? (
              <div className="mt-6 flex flex-1 items-center rounded-[28px] border border-line bg-white px-6 py-8 shadow-card">
                <div className="max-w-xl">
                  <span className="heritage-pill">Athar Match</span>
                  <h3 className="mt-4 font-display text-3xl text-ink">This style is not currently available in Athar.</h3>
                  <p className="mt-4 max-w-lg text-base leading-7 text-ink-soft">
                    {noMatchMessage || 'Try another image or browse our current collection.'}
                  </p>

                  {analysisBadges.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {analysisBadges.map((badge, index) => (
                        <span
                          key={`${badge}-${index}`}
                          className="rounded-full bg-[#f8eee7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f5f45]"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/products')}
                      className="button-primary"
                    >
                      Browse Products
                    </button>
                    <label htmlFor="visual-product-match-image" className="button-secondary cursor-pointer">
                      Try Another Image
                    </label>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default VisualProductMatchPage;
