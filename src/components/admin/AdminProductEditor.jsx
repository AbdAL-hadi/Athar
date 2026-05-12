import { useEffect, useMemo, useState } from 'react';
import { heritageCityOptions } from '../../data/heritageCities';
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

const getUploadImageOrderToken = (index) => `__upload__:${index}`;

const AdminProductEditor = ({
  authToken,
  error,
  form,
  imageFiles,
  isAdmin,
  mode,
  patternImageFile,
  patternStories = [],
  product,
  onCancel,
  onFieldChange,
  onImagesChange,
  onPatternImageChange,
  onSave,
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [filePreviews, setFilePreviews] = useState([]);
  const [patternImagePreview, setPatternImagePreview] = useState('');

  useEffect(() => {
    const previews = imageFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews(previews);

    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageFiles]);

  const existingImages = useMemo(
    () =>
      (Array.isArray(form.images) ? form.images.filter(Boolean) : []).map((image) => ({
        key: `existing:${image}`,
        orderValue: image,
        src: resolveApiAssetUrl(image),
        type: 'existing',
      })),
    [form.images],
  );
  const warehouseStocks = Array.isArray(form.warehouseStocks) ? form.warehouseStocks : [];
  const warehouseTotalStock = warehouseStocks.reduce((sum, stock) => sum + Math.max(0, Number(stock.quantity || 0)), 0);
  const uploadedImages = useMemo(
    () =>
      filePreviews.map((preview, index) => ({
        key: `upload:${index}`,
        orderValue: getUploadImageOrderToken(index),
        src: preview,
        type: 'upload',
      })),
    [filePreviews],
  );
  const galleryImages = useMemo(() => {
    const defaultOrder = [...existingImages, ...uploadedImages];
    const order = Array.isArray(form.imageOrder) ? form.imageOrder.filter(Boolean) : [];

    if (!order.length) {
      return defaultOrder;
    }

    const entryByOrderValue = new Map(defaultOrder.map((entry) => [entry.orderValue, entry]));
    const orderedEntries = order.map((orderValue) => entryByOrderValue.get(orderValue)).filter(Boolean);
    const orderedKeys = new Set(orderedEntries.map((entry) => entry.key));
    const remainingEntries = defaultOrder.filter((entry) => !orderedKeys.has(entry.key));

    return [...orderedEntries, ...remainingEntries];
  }, [existingImages, form.imageOrder, uploadedImages]);
  const activeImage = galleryImages[selectedImage]?.src || galleryImages[0]?.src || '';
  const hasImage = galleryImages.length > 0;

  useEffect(() => {
    if (selectedImage >= galleryImages.length) setSelectedImage(0);
  }, [galleryImages.length, selectedImage]);

  useEffect(() => {
    if (!patternImageFile) {
      setPatternImagePreview('');
      return undefined;
    }

    const preview = URL.createObjectURL(patternImageFile);
    setPatternImagePreview(preview);

    return () => URL.revokeObjectURL(preview);
  }, [patternImageFile]);

  const handleUpload = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    onImagesChange((currentFiles) => [...currentFiles, ...nextFiles]);
    event.target.value = '';
  };

  const handleSetMainImage = (index) => {
    const selectedEntry = galleryImages[index];

    if (!selectedEntry) {
      return;
    }

    const nextOrder = [
      selectedEntry.orderValue,
      ...galleryImages
        .filter((entry) => entry.key !== selectedEntry.key)
        .map((entry) => entry.orderValue),
    ];
    const nextExistingImages = galleryImages
      .filter((entry) => entry.key === selectedEntry.key || entry.type === 'existing')
      .sort((a, b) => nextOrder.indexOf(a.orderValue) - nextOrder.indexOf(b.orderValue))
      .filter((entry) => entry.type === 'existing')
      .map((entry) => entry.orderValue);

    onFieldChange('images', nextExistingImages);
    onFieldChange('imageOrder', nextOrder);
    setSelectedImage(0);
  };

  const handlePatternImageUpload = (event) => {
    const [nextFile] = Array.from(event.target.files || []);
    onPatternImageChange(nextFile ?? null);
    event.target.value = '';
  };

  const handleApplySuggestion = (field, value) => {
    onFieldChange(field, value);
  };

  const handleWarehouseStockChange = (warehouseId, field, value) => {
    const nextStocks = warehouseStocks.map((stock) =>
      stock.warehouseId === warehouseId
        ? {
            ...stock,
            [field]: value,
          }
        : stock,
    );

    onFieldChange('warehouseStocks', nextStocks);
  };

  const patternImageUrl = patternImagePreview || resolveApiAssetUrl(form.patternImage || '');

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
                    <div
                      key={`${image.key}-${index}`}
                      className={`overflow-hidden rounded-[16px] border bg-cream ${
                        selectedImage === index ? 'border-ink' : 'border-line'
                      }`}
                    >
                      <button type="button" onClick={() => setSelectedImage(index)} className="relative block w-full">
                        <img src={image.src} alt={`Product view ${index + 1}`} className="aspect-square w-full object-cover" />
                        {index === 0 ? (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                            Main image
                          </span>
                        ) : null}
                      </button>
                      {index === 0 ? null : (
                        <button
                          type="button"
                          onClick={() => handleSetMainImage(index)}
                          className="block w-full bg-white px-2 py-2 text-xs font-semibold text-[#8f5f45] transition hover:bg-[#fff7f0]"
                        >
                          Set as main
                        </button>
                      )}
                    </div>
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
                    Leave empty to calculate points automatically from price: 1 shekel = 1 point.
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
                    <FieldLabel>Inspired by City</FieldLabel>
                    <select
                      value={form.inspiredByCity || ''}
                      onChange={(event) => onFieldChange('inspiredByCity', event.target.value)}
                      className={fieldClassName}
                    >
                      <option value="">No city selected</option>
                      {heritageCityOptions.map((city) => (
                        <option key={city.value} value={city.value}>
                          {city.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-ink-soft">Optional. Products assigned here can appear on the Heritage Map.</p>
                  </div>
                  <div>
                    <FieldLabel>Motif Tags</FieldLabel>
                    <input
                      type="text"
                      value={Array.isArray(form.motifTags) ? form.motifTags.join(', ') : form.motifTags || ''}
                      onChange={(event) => onFieldChange('motifTags', event.target.value)}
                      className={fieldClassName}
                      placeholder="dome, olive branch, embroidery"
                    />
                    <p className="mt-2 text-sm text-ink-soft">Separate tags with commas.</p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Total stock preview</FieldLabel>
                    <input
                      type="number"
                      value={warehouseStocks.length > 0 ? warehouseTotalStock : form.stock}
                      onChange={(event) => onFieldChange('stock', event.target.value)}
                      className={fieldClassName}
                      min="0"
                      step="1"
                      placeholder="0"
                      readOnly={warehouseStocks.length > 0}
                    />
                    <p className="mt-2 text-sm text-ink-soft">
                      Availability preview: {Number((warehouseStocks.length > 0 ? warehouseTotalStock : form.stock) || 0) > 0 ? `${warehouseStocks.length > 0 ? warehouseTotalStock : form.stock} in stock` : 'Out of stock'}
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

                {warehouseStocks.length > 0 ? (
                  <div className="rounded-[26px] border border-line bg-[#fffaf8] p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.18em] text-muted">Warehouse Stock</p>
                        <h4 className="mt-2 font-display text-3xl text-ink">Distribution by city</h4>
                      </div>
                      <p className="text-sm font-semibold text-ink">Total stock preview: {warehouseTotalStock}</p>
                    </div>

                    <div className="mt-5 space-y-3">
                      {warehouseStocks.map((stock) => (
                        <div
                          key={stock.warehouseId}
                          className="rounded-[20px] border border-line bg-white p-4"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">{stock.warehouseName}</p>
                            <p className="mt-1 text-sm text-ink-soft">{stock.cityLabel || stock.city}</p>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="min-w-0">
                              <FieldLabel>Quantity</FieldLabel>
                              <input
                                type="number"
                                value={stock.quantity}
                                onChange={(event) => handleWarehouseStockChange(stock.warehouseId, 'quantity', event.target.value)}
                                className={fieldClassName}
                                min="0"
                                step="1"
                              />
                            </div>
                            <div className="min-w-0">
                              <FieldLabel>Low threshold</FieldLabel>
                              <input
                                type="number"
                                value={stock.lowStockThreshold}
                                onChange={(event) => handleWarehouseStockChange(stock.warehouseId, 'lowStockThreshold', event.target.value)}
                                className={fieldClassName}
                                min="0"
                                step="1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[26px] border border-line bg-[#fffaf8] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-muted">Pattern Story (optional)</p>
                      <h4 className="mt-2 font-display text-3xl text-ink">Attach motif storytelling</h4>
                      <p className="mt-2 text-sm leading-6 text-ink-soft">
                        Product code stays separate. Attach a story only when this product needs a public pattern page.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={Boolean(form.attachPatternStory)}
                        onChange={(event) => onFieldChange('attachPatternStory', event.target.checked)}
                        className="h-5 w-5 accent-[#b77b6f]"
                      />
                      Attach pattern story
                    </label>
                  </div>

                  {form.attachPatternStory ? (
                    <div className="mt-5 space-y-5">
                      {patternStories.length > 0 ? (
                        <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                          <div>
                            <FieldLabel>Story option</FieldLabel>
                            <select
                              value={form.patternMode || 'new'}
                              onChange={(event) => onFieldChange('patternMode', event.target.value)}
                              className={fieldClassName}
                            >
                              <option value="new">Create / edit story</option>
                              <option value="existing">Use existing story</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>Existing Pattern</FieldLabel>
                            <select
                              value={form.patternStoryId || ''}
                              onChange={(event) => onFieldChange('patternStoryId', event.target.value)}
                              className={fieldClassName}
                              disabled={form.patternMode !== 'existing'}
                            >
                              <option value="">Choose existing pattern</option>
                              {patternStories.map((story) => (
                                <option key={story.id || story._id} value={story.id || story._id}>
                                  {story.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}

                      {form.patternMode !== 'existing' ? (
                        <>
                          <div className="grid gap-5 md:grid-cols-2">
                            <div>
                              <FieldLabel>Pattern Title</FieldLabel>
                              <input
                                type="text"
                                value={form.patternTitle || ''}
                                onChange={(event) => onFieldChange('patternTitle', event.target.value)}
                                className={fieldClassName}
                                placeholder="Hebron Vine Piece"
                              />
                            </div>
                            <div>
                              <FieldLabel>Pattern Motif Tags</FieldLabel>
                              <input
                                type="text"
                                value={form.patternMotifTags || ''}
                                onChange={(event) => onFieldChange('patternMotifTags', event.target.value)}
                                className={fieldClassName}
                                placeholder="grapevine, hebron, embroidery"
                              />
                            </div>
                          </div>

                          <div>
                            <FieldLabel>Pattern Description</FieldLabel>
                            <textarea
                              value={form.patternDescription || ''}
                              onChange={(event) => onFieldChange('patternDescription', event.target.value)}
                              className={`${fieldClassName} min-h-32 resize-y leading-7`}
                              rows="4"
                              placeholder="Tell the heritage story behind this motif."
                            />
                          </div>

                          <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
                            <div className="overflow-hidden rounded-[22px] bg-cream">
                              {patternImageUrl ? (
                                <img src={patternImageUrl} alt={form.patternTitle || 'Pattern preview'} className="aspect-square w-full object-cover" />
                              ) : (
                                <div className="flex aspect-square items-center justify-center px-4 text-center text-sm text-ink-soft">
                                  Pattern image preview
                                </div>
                              )}
                            </div>
                            <div>
                              <FieldLabel>Pattern Image</FieldLabel>
                              <label className="button-secondary inline-flex cursor-pointer px-5 py-2 text-sm">
                                {patternImageUrl ? 'Replace pattern image' : 'Upload pattern image'}
                                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handlePatternImageUpload} />
                              </label>
                              <p className="mt-2 text-sm text-ink-soft">Optional, but recommended for the public Pattern Story page.</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="rounded-[20px] bg-white px-4 py-3 text-sm leading-6 text-ink-soft">
                          This product will link to the selected story. To change the story copy, switch back to create / edit.
                        </p>
                      )}
                    </div>
                  ) : null}
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
