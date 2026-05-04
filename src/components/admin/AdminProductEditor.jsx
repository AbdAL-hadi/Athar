import { useEffect, useMemo, useState } from 'react';
import { resolveApiAssetUrl } from '../../utils/api';
import AdminAiAssistPanel from './AdminAiAssistPanel';

const categories = ['Bags', 'Bracelets', 'Rings', 'Wallets', 'Accessories', 'Watches'];

const FieldLabel = ({ children }) => (
  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
    {children}
  </label>
);

const fieldClassName =
  'min-h-12 w-full rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/15';

const AdminProductEditor = ({
  authToken,
  error,
  form,
  imageFiles,
  isAdmin,
  mode,
  product,
  onCancel,
  onFieldChange,
  onImagesChange,
  onSave,
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [filePreviews, setFilePreviews] = useState([]);

  useEffect(() => {
    const previews = imageFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews(previews);

    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles]);

  const existingImages = useMemo(
    () => (Array.isArray(form.images) ? form.images.filter(Boolean).map((image) => resolveApiAssetUrl(image)) : []),
    [form.images],
  );
  const galleryImages = [...existingImages, ...filePreviews];
  const activeImage = galleryImages[selectedImage] || galleryImages[0] || '';
  const hasImage = galleryImages.length > 0;

  useEffect(() => {
    if (selectedImage >= galleryImages.length) setSelectedImage(0);
  }, [galleryImages.length, selectedImage]);

  const handleUpload = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    onImagesChange((currentFiles) => [...currentFiles, ...nextFiles]);
    event.target.value = '';
  };

  const handleApplySuggestion = (field, value) => {
    onFieldChange(field, value);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[32px] bg-[#fcf8f6] shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-line bg-white px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-5xl text-ink">
              {mode === 'create' ? 'Add Product' : 'Edit Product'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Preview the product like a details page, apply AI suggestions only when they feel right, then save.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border-2 border-line px-6 py-3 text-sm font-semibold text-ink transition hover:bg-cream"
            >
              Cancel
            </button>
            <button type="button" onClick={onSave} className="button-primary px-6 py-3 text-sm">
              Save Product
            </button>
          </div>
        </div>

        <div className="max-h-[78vh] overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-8">
          {error ? (
            <div className="mb-5 rounded-[22px] border border-[#e7c8c8] bg-white px-5 py-4 text-sm text-[#8c6546] shadow-card">
              {error}
            </div>
          ) : null}

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)_minmax(300px,380px)]">
            <section className="min-w-0 rounded-[28px] border border-line bg-white p-4 shadow-card sm:p-5">
              <div className="overflow-hidden rounded-[24px] bg-cream">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={form.title || 'Product preview'}
                    className="aspect-[4/5] w-full object-cover object-center"
                  />
                ) : (
                  <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="font-display text-3xl text-ink">Upload product images to start</span>
                    <span className="text-sm leading-6 text-ink-soft">
                      New images preview here immediately and unlock AI generation.
                    </span>
                    <span className="button-primary px-5 py-2 text-sm">Choose images</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={handleUpload} />
                  </label>
                )}
              </div>

              {hasImage ? (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {galleryImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={`overflow-hidden rounded-[16px] border bg-cream ${
                        selectedImage === index ? 'border-ink' : 'border-line'
                      }`}
                    >
                      <img src={image} alt={`Product view ${index + 1}`} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="mt-5 block">
                <span className="button-secondary inline-flex cursor-pointer px-5 py-2 text-sm">
                  {hasImage ? 'Add more images' : 'Choose images'}
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={handleUpload} />
              </label>
            </section>

            <section className="min-w-0 rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-6">
              <div className="mb-5">
                <p className="text-sm uppercase tracking-[0.18em] text-muted">Product details</p>
                <h3 className="mt-2 font-display text-4xl text-ink">{form.title || 'Untitled product'}</h3>
                <p className="mt-2 text-sm text-ink-soft">{Number(form.stock || 0) > 0 ? `${form.stock} in stock` : 'Out of stock'}</p>
              </div>

              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <select value={form.category} onChange={(event) => onFieldChange('category', event.target.value)} className={fieldClassName}>
                      <option value="">Choose category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Product code (optional)</FieldLabel>
                    <input
                      type="text"
                      value={form.sku}
                      onChange={(event) => onFieldChange('sku', event.target.value)}
                      className={fieldClassName}
                      placeholder="Athar_04"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Product title/name</FieldLabel>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => onFieldChange('title', event.target.value)}
                    className={fieldClassName}
                    placeholder="Enter product title"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Price</FieldLabel>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(event) => onFieldChange('price', event.target.value)}
                      className={fieldClassName}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <FieldLabel>Old price / compare-at price</FieldLabel>
                    <input
                      type="number"
                      value={form.compareAt}
                      onChange={(event) => onFieldChange('compareAt', event.target.value)}
                      className={fieldClassName}
                      min="0"
                      step="0.01"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Points Value (optional)</FieldLabel>
                  <input
                    type="number"
                    value={form.pointsValue}
                    onChange={(event) => onFieldChange('pointsValue', event.target.value)}
                    className={fieldClassName}
                    min="0"
                    step="1"
                    placeholder="Auto from price"
                  />
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    Leave empty to calculate points automatically from price: 1 dollar = 1 point.
                  </p>
                </div>

                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={form.description}
                    onChange={(event) => onFieldChange('description', event.target.value)}
                    className={`${fieldClassName} min-h-32 resize-y leading-7`}
                    rows="4"
                    placeholder="Enter product description"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Material</FieldLabel>
                    <input
                      type="text"
                      value={form.material}
                      onChange={(event) => onFieldChange('material', event.target.value)}
                      className={fieldClassName}
                      placeholder="Engraved black leather"
                    />
                  </div>
                  <div>
                    <FieldLabel>Color (optional)</FieldLabel>
                    <input
                      type="text"
                      value={form.color}
                      onChange={(event) => onFieldChange('color', event.target.value)}
                      className={fieldClassName}
                      placeholder="gold"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Stock number</FieldLabel>
                    <input
                      type="number"
                      value={form.stock}
                      onChange={(event) => onFieldChange('stock', event.target.value)}
                      className={fieldClassName}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                    <p className="mt-2 text-sm text-ink-soft">
                      Availability preview: {Number(form.stock || 0) > 0 ? `${form.stock} in stock` : 'Out of stock'}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <label className="flex min-h-12 w-full items-center justify-between gap-4 rounded-[18px] border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">
                      <span>Try-on eligible</span>
                      <input
                        type="checkbox"
                        checked={Boolean(form.tryOnEligible)}
                        onChange={(event) => onFieldChange('tryOnEligible', event.target.checked)}
                        className="h-5 w-5 accent-[#b77b6f]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {isAdmin ? (
              <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
                <AdminAiAssistPanel
                  authToken={authToken}
                  product={{ ...product, ...form, name: form.title }}
                  imageFiles={imageFiles}
                  hasImage={hasImage}
                  onApply={handleApplySuggestion}
                />
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductEditor;
