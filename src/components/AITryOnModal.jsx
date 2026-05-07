import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const createPreviewUrl = (file) => (file ? URL.createObjectURL(file) : '');

const downloadImage = (imageUrl) => {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = 'athar-ai-try-on-preview.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const AITryOnModal = ({ product, open, onClose }) => {
  const [userImage, setUserImage] = useState(null);
  const [userPreviewUrl, setUserPreviewUrl] = useState('');
  const [style, setStyle] = useState('realistic');
  const [resultImage, setResultImage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const productImage = useMemo(
    () => resolveApiAssetUrl(product?.images?.[0]),
    [product?.images],
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setUserImage(null);
    setUserPreviewUrl('');
    setResultImage('');
    setError('');
    setMessage('');
    setStyle('realistic');

    return undefined;
  }, [open, product?.id]);

  useEffect(() => {
    return () => {
      if (userPreviewUrl) {
        URL.revokeObjectURL(userPreviewUrl);
      }
    };
  }, [userPreviewUrl]);

  if (!open || !product) {
    return null;
  }

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setError('');
    setMessage('');
    setResultImage('');

    if (!nextFile) {
      setUserImage(null);
      setUserPreviewUrl('');
      return;
    }

    if (!allowedTypes.has(nextFile.type)) {
      setError('Only JPG, PNG, or WEBP images are allowed.');
      setUserImage(null);
      setUserPreviewUrl('');
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setError('The image is too large. Please upload a file under 5MB.');
      setUserImage(null);
      setUserPreviewUrl('');
      return;
    }

    const nextPreviewUrl = createPreviewUrl(nextFile);
    setUserPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return nextPreviewUrl;
    });
    setUserImage(nextFile);
  };

  const handleGenerate = async () => {
    setError('');
    setMessage('');

    if (!userImage) {
      setError('Please upload your photo first.');
      return;
    }

    const formData = new FormData();
    formData.append('userImage', userImage);
    formData.append('productId', product.productId || product.slug || product.id);
    formData.append('style', style);

    setIsGenerating(true);

    try {
      const response = await apiRequest('/api/ai-try-on', {
        method: 'POST',
        body: formData,
      });
      const nextImage = response?.data?.image || response?.data?.resultUrl || '';

      if (!nextImage) {
        throw new Error('No preview image was returned.');
      }

      setResultImage(resolveApiAssetUrl(nextImage));
      setMessage(response?.data?.message || 'AI try-on preview generated successfully.');
    } catch (generateError) {
      setError(
        generateError.message ||
          "We couldn't generate a try-on preview right now. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[34px] bg-[#fffaf8] p-5 shadow-[0_28px_90px_rgba(43,26,20,0.24)] sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-try-on-title"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">AI Try-On Preview</p>
            <h2 id="ai-try-on-title" className="mt-2 font-display text-4xl text-ink">
              Try {product.name}
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-ink-soft">
              Upload a clear front-facing or well-lit photo. This creates an AI preview, not a guaranteed perfect AR fitting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-cream"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="space-y-4">
            <div className="rounded-[28px] bg-white p-4 shadow-card">
              <img
                src={productImage}
                alt={product.name}
                className="h-64 w-full rounded-[22px] object-cover"
              />
              <h3 className="mt-4 font-display text-3xl text-ink">{product.name}</h3>
              <p className="text-sm uppercase tracking-[0.16em] text-muted">{product.category}</p>
              <p className="mt-3 text-sm leading-7 text-ink-soft">{product.description}</p>
            </div>

            <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
              Privacy note: Your uploaded photo is used only to generate your try-on preview.
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[28px] border border-line bg-white p-5 shadow-card">
              <label className="block">
                <span className="text-sm font-bold text-ink">Upload your photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="mt-3 block w-full rounded-[18px] border border-line bg-[#fffaf8] px-4 py-3 text-sm text-ink"
                  disabled={isGenerating}
                />
              </label>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-ink">Framing style</span>
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    className="w-full rounded-[18px] border border-line bg-[#fffaf8] px-4 py-3 text-sm text-ink"
                    disabled={isGenerating}
                  >
                    <option value="realistic">Realistic</option>
                    <option value="studio-fashion">Studio fashion</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="self-end rounded-[18px] bg-blush px-6 py-3 font-semibold text-ink transition hover:bg-rose disabled:cursor-wait disabled:bg-cream disabled:text-muted"
                >
                  {isGenerating ? 'Generating...' : 'Generate Preview'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[22px] border border-[#e7c8c8] bg-white px-4 py-3 text-sm text-[#8c6546]">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-[22px] border border-[#bdd8bc] bg-[#f1faf0] px-4 py-3 text-sm text-[#2f6a35]">
                {message}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-white p-4 shadow-card">
                <p className="text-sm font-bold text-ink">Your photo</p>
                {userPreviewUrl ? (
                  <img
                    src={userPreviewUrl}
                    alt="Uploaded user preview"
                    className="mt-3 h-72 w-full rounded-[22px] object-cover"
                  />
                ) : (
                  <div className="mt-3 flex h-72 items-center justify-center rounded-[22px] bg-cream px-4 text-center text-sm text-ink-soft">
                    Your uploaded image preview will appear here.
                  </div>
                )}
              </div>

              <div className="rounded-[28px] bg-white p-4 shadow-card">
                <p className="text-sm font-bold text-ink">Result</p>
                {isGenerating ? (
                  <div className="mt-3 flex h-72 flex-col items-center justify-center rounded-[22px] bg-cream px-4 text-center text-sm text-ink-soft">
                    <span className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blush border-t-rose" />
                    Generating your AI try-on preview...
                  </div>
                ) : resultImage ? (
                  <img
                    src={resultImage}
                    alt="Generated AI try-on preview"
                    className="mt-3 h-72 w-full rounded-[22px] object-cover"
                  />
                ) : (
                  <div className="mt-3 flex h-72 items-center justify-center rounded-[22px] bg-cream px-4 text-center text-sm text-ink-soft">
                    Your generated preview will appear here.
                  </div>
                )}
              </div>
            </div>

            {resultImage ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadImage(resultImage)}
                  className="button-primary"
                >
                  Download result
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="button-secondary disabled:opacity-60"
                >
                  Regenerate once
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </motion.div>
    </div>
  );
};

export default AITryOnModal;
