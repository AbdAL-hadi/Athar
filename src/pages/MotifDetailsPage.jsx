import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motifStoryLookup } from '../data/motifs';
import { resolveApiAssetUrl } from '../utils/api';
import { findProductByReference } from '../utils/productCatalog';

const SearchIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const MotifDetailsPage = ({ products = [] }) => {
  const { motifId } = useParams();
  const [searchParams] = useSearchParams();
  const motif = motifStoryLookup.get(motifId);
  const requestedProductId = searchParams.get('product') ?? '';
  const requestedProduct = requestedProductId ? findProductByReference(products, requestedProductId) : null;
  const linkedProducts = motif?.productIds?.map((productId) => findProductByReference(products, productId)).filter(Boolean) ?? [];
  const featuredProduct = requestedProduct && motif?.productIds?.includes(requestedProduct.id) ? requestedProduct : linkedProducts[0] ?? null;
  const logo = resolveApiAssetUrl('products/athar.jpg');
  const motifImageUrl = resolveApiAssetUrl(motif?.image ?? '');

  if (!motif) {
    return (
      <div className="section-shell pt-14">
        <div className="rounded-[32px] bg-white px-7 py-14 text-center shadow-soft">
          <h1 className="font-display text-5xl text-ink">Pattern not found</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
            The Athar pattern story you requested is not available right now.
          </p>
          <Link to="/products" className="button-primary mt-8">
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  const backTarget = featuredProduct ? `/products/${featuredProduct.id}` : '/products';
  const backLabel = featuredProduct ? 'Back to the product' : 'Back to products';

  return (
    <div className="section-shell space-y-10 pb-8 pt-8">
      <section className="rounded-[32px] bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-[20px] bg-blush p-1.5">
            <img src={logo} alt="Athar logo" className="h-14 w-14 rounded-[18px] object-cover" />
          </div>
          <div className="flex flex-1 items-center justify-between rounded-full bg-blush px-6 py-4 text-ink shadow-[inset_0_0_0_1px_rgba(140,101,70,0.04)]">
            <span className="font-display text-2xl font-semibold tracking-[0.03em]">{motif.code}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink-soft">
              <SearchIcon />
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] bg-white px-7 py-10 shadow-soft sm:px-10">
        <div className="grid gap-10 lg:grid-cols-[260px_1fr] lg:items-start">
          <div className="rounded-[28px] bg-cream p-5">
            {motifImageUrl ? (
              <img src={motifImageUrl} alt={motif.title} className="h-[220px] w-full rounded-[22px] object-cover" />
            ) : (
              <img src={logo} alt="Athar logo" className="mx-auto h-[220px] w-full rounded-[22px] object-cover" />
            )}
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-muted">Pattern Story</p>
            <h1 className="mt-4 font-display text-5xl font-bold text-ink sm:text-6xl">{motif.title}</h1>
            <div className="mt-6 h-px w-full max-w-[220px] bg-line" />
            <p className="mt-6 max-w-4xl text-2xl leading-10 text-ink-soft">{motif.description}</p>

            <div className="mt-8">
              <p className="text-sm uppercase tracking-[0.18em] text-muted">Used On</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {linkedProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-rose hover:bg-blush"
                  >
                    {product.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center lg:justify-start">
          <Link to={backTarget} className="button-primary min-w-[240px] justify-center text-lg">
            {backLabel}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MotifDetailsPage;
