import { useEffect, useMemo, useState } from 'react';
import SectionTitle from '../components/SectionTitle';
import Toast from '../components/Toast';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';

const acceptedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxFileSizeMb = 10;
const pipelineSteps = [
  'Grounding DINO detects the glasses in the source image through your configured Hugging Face Space.',
  'A local SAM microservice isolates the glasses precisely from the detected region.',
  'Mask refinement cleans the edges and improves the final cutout.',
  'Internal MediaPipe facial landmarks calculates eye, nose, scale, and rotation.',
  'FLUX Fill blends the glasses naturally on your face.',
];

const createPreviewUrl = (file) => (file ? URL.createObjectURL(file) : '');

const validateImageFile = (file, label) => {
  if (!file) {
    return `${label} is required.`;
  }

  if (!acceptedMimeTypes.includes(file.type)) {
    return `${label} must be a JPG, PNG, or WEBP image.`;
  }

  if (file.size > maxFileSizeMb * 1024 * 1024) {
    return `${label} must be ${maxFileSizeMb}MB or smaller.`;
  }

  return '';
};

const ImageUploadCard = ({
  label,
  description,
  file,
  previewUrl,
  error,
  inputId,
  onFileChange,
}) => (
  <div className="surface-card p-6">
    <label htmlFor={inputId} className="block">
      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{label}</span>
      <p className="mt-2 text-base leading-7 text-ink-soft">{description}</p>
      <div className="mt-5 rounded-[28px] border border-dashed border-line bg-cream p-5 transition hover:border-rose">
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={onFileChange}
        />
        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] bg-white px-5 py-4 text-sm text-ink-soft shadow-card">
            {file ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{file.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <span className="button-secondary px-4 py-2 text-sm">Replace</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-ink-soft">Click to upload an image</p>
                <span className="button-secondary px-4 py-2 text-sm">Choose file</span>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[28px] border border-line bg-white">
            {previewUrl ? (
              <img src={previewUrl} alt={label} className="h-72 w-full object-cover" />
            ) : (
              <div className="flex h-72 items-center justify-center px-6 text-center text-sm leading-7 text-ink-soft">
                Preview will appear here after you upload the image.
              </div>
            )}
          </div>
        </div>
      </div>
    </label>
    {error ? <p className="mt-3 text-sm text-[#b46a6a]">{error}</p> : null}
  </div>
);

const GlassesTryOnPage = () => {
  const [glassesImage, setGlassesImage] = useState(null);
  const [targetImage, setTargetImage] = useState(null);
  const [glassesPreviewUrl, setGlassesPreviewUrl] = useState('');
  const [targetPreviewUrl, setTargetPreviewUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, variant: 'success', message: '' });

  useEffect(() => {
    const nextUrl = createPreviewUrl(glassesImage);
    setGlassesPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return nextUrl;
    });

    return () => {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [glassesImage]);

  useEffect(() => {
    const nextUrl = createPreviewUrl(targetImage);
    setTargetPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return nextUrl;
    });

    return () => {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [targetImage]);

  const resultImageUrl = useMemo(
    () =>
      result?.resultUrl || result?.resultBase64
        ? resolveApiAssetUrl(result.resultUrl || result.resultBase64)
        : '',
    [result],
  );

  const handleFileSelection = (fieldName) => (event) => {
    const file = event.target.files?.[0] || null;

    setErrors((current) => ({ ...current, [fieldName]: '' }));
    setApiError('');
    setResult(null);

    if (fieldName === 'glassesImage') {
      setGlassesImage(file);
      return;
    }

    setTargetImage(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {
      glassesImage: validateImageFile(glassesImage, 'Glasses image'),
      targetImage: validateImageFile(targetImage, 'Your image'),
    };

    setErrors(nextErrors);
    setApiError('');
    setResult(null);

    if (nextErrors.glassesImage || nextErrors.targetImage) {
      return;
    }

    const formData = new FormData();
    formData.append('glassesImage', glassesImage);
    formData.append('targetImage', targetImage);

    setIsSubmitting(true);

    try {
      const response = await apiRequest('/api/ai/glasses-try-on', {
        method: 'POST',
        body: formData,
      });

      setResult(response.data);
      setToast({
        open: true,
        variant: 'success',
        message: response.message || 'Glasses try-on preview generated successfully.',
      });
    } catch (error) {
      setApiError(
        error.message ||
          'We could not generate the glasses preview. Please try a clearer face image and a clearer glasses image.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="section-shell space-y-8 pb-8 pt-8">
      <SectionTitle
        eyebrow="AI Try-On"
        title="Virtual Glasses Try-On"
        description="Upload one image that clearly contains the glasses you want to borrow, and one image of your face. Athar will run the glasses-only AI pipeline and return a preview you can validate before we expand the system to other accessories."
      />

      <section className="surface-card p-6">
        <h3 className="font-display text-3xl text-ink">How this first phase works</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          {pipelineSteps.map((step, index) => (
            <div key={step} className="rounded-[24px] bg-cream px-4 py-4 shadow-card">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Step {index + 1}</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-8 xl:grid-cols-2">
          <ImageUploadCard
            label="Upload glasses image"
            description="Use a source image where the eyewear is clearly visible. A person wearing glasses or a product shot both work for this first phase."
            file={glassesImage}
            previewUrl={glassesPreviewUrl}
            error={errors.glassesImage}
            inputId="glasses-image-upload"
            onFileChange={handleFileSelection('glassesImage')}
          />

          <ImageUploadCard
            label="Upload your image"
            description="Use a front-facing portrait with good lighting. The face landmarks stage uses this image to compute the glasses position, size, and rotation."
            file={targetImage}
            previewUrl={targetPreviewUrl}
            error={errors.targetImage}
            inputId="target-image-upload"
            onFileChange={handleFileSelection('targetImage')}
          />
        </div>

        <section className="surface-card p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h3 className="font-display text-3xl text-ink">Generate preview</h3>
              <p className="mt-2 text-base leading-8 text-ink-soft">
                This route is configured for the glasses-only AI pipeline. If any model cannot detect the eyewear or the face, you will see a friendly error instead of a silent failure.
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="button-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {isSubmitting ? (
            <div className="mt-6 rounded-[24px] border border-line bg-cream px-5 py-5">
              <div className="flex items-start gap-4">
                <span className="mt-1 inline-flex h-5 w-5 animate-spin rounded-full border-2 border-rose/30 border-t-rose" />
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-muted">Processing</p>
                  <p className="mt-2 text-base text-ink-soft">
                    Athar is running Grounding DINO through your Gradio Space, local SAM segmentation, mask refinement, internal MediaPipe facial landmarks, and FLUX Fill in sequence. This can take a little time depending on your configured models, local services, and Space availability.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {apiError ? (
            <div className="mt-6 rounded-[24px] border border-[#e5c3c3] bg-[#fff8f6] px-5 py-4 text-sm text-[#8b5b5b]">
              {apiError}
            </div>
          ) : null}
        </section>
      </form>

      <section className="surface-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-muted">Result</p>
            <h3 className="mt-2 font-display text-4xl text-ink">Glasses preview</h3>
            <p className="mt-2 max-w-2xl text-base leading-8 text-ink-soft">
              Your generated preview will appear here as soon as the full glasses pipeline finishes successfully.
            </p>
          </div>
          {resultImageUrl ? (
            <a href={resultImageUrl} download className="button-secondary">
              Download result
            </a>
          ) : null}
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-line bg-cream">
          {resultImageUrl ? (
            <img
              src={resultImageUrl}
              alt="Generated glasses try-on result"
              className="w-full object-cover"
            />
          ) : (
            <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-sm leading-7 text-ink-soft">
              Result preview will be displayed here after the AI pipeline completes.
            </div>
          )}
        </div>

        {result?.pipeline ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] bg-white px-5 py-4 shadow-card">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Detected accessory</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">
                {result.pipeline.detection?.label || 'glasses'} with score{' '}
                {Number(result.pipeline.detection?.score || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-[24px] bg-white px-5 py-4 shadow-card">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Face alignment</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">
                Rotation {Number(result.pipeline.alignment?.rotationDegrees || 0).toFixed(2)} deg
              </p>
            </div>
            <div className="rounded-[24px] bg-white px-5 py-4 shadow-card">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Configured models</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">
                Grounding DINO runs through the configured Space, SAM runs through the local FastAPI service, and the remaining stages follow the current backend configuration.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <Toast
        open={toast.open}
        variant={toast.variant}
        message={toast.message}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
      />
    </div>
  );
};

export default GlassesTryOnPage;
