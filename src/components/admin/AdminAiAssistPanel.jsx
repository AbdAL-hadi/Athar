import { useMemo, useState } from 'react';
import { apiRequest } from '../../utils/api';

const actions = [
  { field: 'title', label: 'Generate Title' },
  { field: 'description', label: 'Generate Description' },
  { field: 'material', label: 'Generate Material' },
];

const fieldLabels = {
  title: 'Product title',
  description: 'Product description',
  material: 'Product material',
};

const AdminAiAssistPanel = ({ authToken, product, imageFiles = [], hasImage, onApply }) => {
  const [activeField, setActiveField] = useState('');
  const [loadingField, setLoadingField] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const previewValue = useMemo(() => {
    if (!suggestion?.result || !suggestion.field) return '';
    return suggestion.result[suggestion.field] || '';
  }, [suggestion]);

  const buildProductContext = () => ({
    name: product?.title || product?.name || '',
    category: product?.category || '',
    description: product?.description || '',
    material: product?.material || '',
    price: product?.price || '',
    notes: product?.notes || '',
  });

  const generate = async (field = activeField) => {
    setError('');
    setMessage('');

    if (!hasImage) {
      setError('Upload at least one product image to use AI generation.');
      return;
    }

    setActiveField(field);
    setLoadingField(field);

    try {
      const body = new FormData();
      body.append('field', field);
      body.append('productId', product?._id || product?.id || '');
      body.append('product', JSON.stringify(buildProductContext()));

      if (imageFiles[0]) {
        body.append('image', imageFiles[0]);
      }

      const response = await apiRequest('/api/admin/ai-assist/product-field', {
        method: 'POST',
        token: authToken,
        body,
      });

      setSuggestion(response?.data ?? null);
    } catch (generateError) {
      setError(
        generateError?.message ||
          'AI Assist could not generate content right now. Please keep editing manually or try again.',
      );
    } finally {
      setLoadingField('');
    }
  };

  const handleApply = () => {
    if (!suggestion?.field || !previewValue) return;

    onApply?.(suggestion.field, previewValue);
    setMessage('Suggestion applied to the form. Click Save Product when you are ready to persist it.');
  };

  const clearSuggestion = () => {
    setSuggestion(null);
    setActiveField('');
    setMessage('');
    setError('');
  };

  return (
    <section className="rounded-[28px] border border-line bg-[#fffaf8] p-5 shadow-card">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-muted">AI Assist</p>
        <h3 className="mt-2 font-display text-3xl text-ink">Product field generator</h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Generate one field at a time from product imagery and the details already typed here.
        </p>
      </div>

      {!hasImage ? (
        <div className="mt-5 rounded-[20px] border border-line bg-white px-4 py-3 text-sm text-ink-soft">
          Upload at least one product image to use AI generation.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {actions.map((action) => {
          const isLoading = loadingField === action.field;

          return (
            <button
              key={action.field}
              type="button"
              onClick={() => generate(action.field)}
              disabled={!hasImage || Boolean(loadingField)}
              className={`rounded-[18px] border px-4 py-3 text-sm font-semibold transition ${
                hasImage
                  ? 'border-ink bg-ink text-white hover:bg-ink/85'
                  : 'cursor-not-allowed border-line bg-cream text-muted'
              } ${loadingField && !isLoading ? 'opacity-60' : ''}`}
            >
              {isLoading ? 'Generating...' : action.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="mt-4 rounded-[20px] border border-[#e7c8c8] bg-white px-4 py-3 text-sm text-[#8c6546]">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-[20px] border border-[#bdd8bc] bg-[#f1faf0] px-4 py-3 text-sm text-[#2f6a35]">
          {message}
        </div>
      ) : null}

      {suggestion ? (
        <div className="mt-5 rounded-[22px] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Preview</p>
          <h4 className="mt-1 font-display text-2xl text-ink">
            {fieldLabels[suggestion.field] || 'Generated suggestion'}
          </h4>
          <div className="mt-4 rounded-[18px] bg-cream p-4 text-sm leading-7 text-ink-soft">
            {previewValue || 'Gemini did not return a usable suggestion.'}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleApply} className="button-primary px-4 py-2 text-sm">
              Apply
            </button>
            <button
              type="button"
              onClick={() => generate(suggestion.field)}
              disabled={Boolean(loadingField)}
              className="button-secondary px-4 py-2 text-sm disabled:opacity-60"
            >
              Regenerate
            </button>
            <button type="button" onClick={clearSuggestion} className="button-secondary px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default AdminAiAssistPanel;
