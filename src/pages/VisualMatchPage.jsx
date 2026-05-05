import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { normalizeProduct } from '../utils/productCatalog';

const acceptedImageTypes = 'image/png,image/jpeg,image/webp';

const VisualMatchPage = ({ onAddToCart }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unavailableState, setUnavailableState] = useState(null);
  const [result, setResult] = useState(null);

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
    setResult(null);
    setUnavailableState(null);
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Please upload an image before searching for a match.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setResult(null);
    setUnavailableState(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await apiRequest('/api/products/visual-match', {
        method: 'POST',
        body: formData,
      });
      const matchResult = response?.data ?? null;

      if (response?.available === false) {
        const availabilityReason = String(response?.availabilityReason || '').trim();
        setUnavailableState({
          type: availabilityReason === 'no_catalog_products' ? 'catalog_empty' : 'no_close_enough_match',
          message:
            availabilityReason === 'no_catalog_products'
              ? 'No products are available in the store catalog right now.'
              : "Sorry, we could not find a close enough similar product in Athar's current collection.",
        });
        return;
      }

      if (!matchResult?.product) {
        setErrorMessage(response?.message || 'We could not compare this image against the catalog right now.');
        return;
      }

      setResult(
        matchResult?.product
          ? {
              ...matchResult,
              product: normalizeProduct(matchResult.product),
            }
          : matchResult,
      );
    } catch (error) {
      const isValidationError = error?.status === 400;
      setErrorMessage(
        isValidationError
          ? error.message || 'Please upload a clear image to continue.'
          : 'We could not complete the search right now. Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const matchedProduct = result?.product ?? null;
  const productHref = matchedProduct ? `/products/${matchedProduct.slug || matchedProduct.id}` : '';
  const isCatalogEmpty = unavailableState?.type === 'catalog_empty';
  const isNoCloseEnoughMatch = unavailableState?.type === 'no_close_enough_match';
  const matchNote = result
    ? String(result?.matchQuality || 'weak') === 'strong'
      ? 'We found a very similar product.'
      : String(result?.matchQuality || 'weak') === 'medium'
        ? 'We found a product with some similar visual details.'
        : "This is the closest available match in Athar's current collection."
    : '';
  const scorePercentage = Math.round(Number(result?.score || 0) * 100);

  return (
    <div className="section-shell space-y-8 pb-10 pt-8">
      <section className="heritage-surface rounded-[36px] px-6 py-10 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <span className="heritage-pill">Visual Product Match</span>
          <h1 className="mt-5 font-display text-4xl text-ink sm:text-5xl">
            Find a Similar Athar Product
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
            Upload a photo of an item you like, and Athar will look for the closest match in our collection.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="heritage-panel rounded-[32px] p-5 sm:p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label
              htmlFor="visual-match-image"
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
                    <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M4.5 8.5h3l1.2-2h6.6l1.2 2h3a1.5 1.5 0 0 1 1.5 1.5v7a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 4 17V10a1.5 1.5 0 0 1 1.5-1.5Z" />
                      <circle cx="12" cy="13" r="3.25" />
                    </svg>
                  </div>
                  <p className="mt-5 text-lg font-semibold text-ink">Choose a reference image</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    JPG, PNG, or WEBP. Clear front-facing product photos work best for visual matching.
                  </p>
                </div>
              )}
            </label>

            <input
              id="visual-match-image"
              type="file"
              accept={acceptedImageTypes}
              className="sr-only"
              onChange={handleFileChange}
            />

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? 'Analyzing...' : 'Find Similar Product'}
              </button>
              <label htmlFor="visual-match-image" className="button-secondary cursor-pointer">
                Upload Image
              </label>
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
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Match result</p>
              <h2 className="mt-2 font-display text-3xl text-ink">Athar suggestion</h2>
            </div>

            {!result && !unavailableState && !submitting ? (
              <div className="mt-6 flex flex-1 items-center justify-center rounded-[28px] border border-line bg-white/70 px-6 py-10 text-center">
                <p className="max-w-sm text-base leading-7 text-ink-soft">
                  Upload a reference image, then let Athar compare it with the current catalog.
                </p>
              </div>
            ) : null}

            {submitting ? (
              <div className="mt-6 flex flex-1 items-center justify-center rounded-[28px] border border-line bg-white/70 px-6 py-10 text-center">
                <div>
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#d9b7a4] border-t-[#8f5f45]" />
                  <p className="mt-4 text-base text-ink-soft">
                    Athar is analyzing the image and checking the catalog.
                  </p>
                </div>
              </div>
            ) : null}

            {isCatalogEmpty && !submitting ? (
              <div className="mt-6 flex flex-1 items-center justify-center rounded-[28px] border border-line bg-white/70 px-6 py-10 text-center">
                <p className="max-w-sm text-base leading-7 text-ink-soft">
                  {unavailableState?.message}
                </p>
              </div>
            ) : null}

            {isNoCloseEnoughMatch && !submitting ? (
              <div className="mt-6 flex flex-1 items-center rounded-[28px] border border-line bg-white px-6 py-8 shadow-card">
                <div className="max-w-xl">
                  <span className="heritage-pill">Athar Match</span>
                  <h3 className="mt-4 font-display text-3xl text-ink">
                    No close enough match found
                  </h3>
                  <p className="mt-4 max-w-lg text-base leading-7 text-ink-soft">
                    {unavailableState?.message}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/products" className="button-primary">
                      Browse Products
                    </Link>
                    <label htmlFor="visual-match-image" className="button-secondary cursor-pointer">
                      Upload Another Image
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {result && !submitting && matchedProduct ? (
              <div className="mt-6 flex flex-1 flex-col rounded-[28px] bg-white p-4 shadow-card">
                <img
                  src={resolveApiAssetUrl(matchedProduct.images?.[0])}
                  alt={matchedProduct.name}
                  className="aspect-[4/3] w-full rounded-[22px] object-cover"
                />
                <div className="mt-5 flex flex-1 flex-col">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                    Similarity score {scorePercentage}%
                  </p>
                  <h3 className="mt-2 font-display text-3xl text-ink">{matchedProduct.name}</h3>
                  <p className="mt-2 text-sm uppercase tracking-[0.16em] text-muted">
                    {matchedProduct.category}
                  </p>
                  <p className="mt-4 rounded-[18px] bg-[#f8eee7] px-4 py-3 text-sm font-medium leading-6 text-[#8f5f45]">
                    {matchNote}
                  </p>
                  <p className="mt-4 text-base leading-7 text-ink-soft">
                    {result.reason || matchedProduct.description}
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <p className="font-display text-3xl text-ink">
                      {formatCurrency(matchedProduct.price)}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to={productHref} className="button-primary">
                      View Product
                    </Link>
                    <label htmlFor="visual-match-image" className="button-secondary cursor-pointer">
                      Upload Another Image
                    </label>
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">
                    Choose another reference image and click Find Similar Product to search again.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default VisualMatchPage;
