import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { Language, MapStyle, MaptilerLayer } from '@maptiler/leaflet-maptilersdk';
import 'leaflet/dist/leaflet.css';
import { heritageCities } from '../data/heritageCities';
import { apiRequest, resolveApiAssetUrl } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { normalizeProducts } from '../utils/productCatalog';

const mapCenter = [31.82, 35.12];
const palestineBounds = [
  [31.2, 34.2],
  [32.45, 35.65],
];
const mapTilerApiKey = String(import.meta.env.VITE_MAPTILER_API_KEY ?? '').trim();
const openStreetMapTileLayer = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  opacity: 0.18,
};
const normalizeCityId = (value) => String(value ?? '').trim().toLowerCase();

const createCityIcon = (city, isSelected) =>
  L.divIcon({
    className: '',
    html: `
      <button
        type="button"
        class="heritage-city-marker ${isSelected ? 'is-selected' : ''}"
        aria-label="Explore ${city.name}"
        title="${city.name}"
      >
        <span class="heritage-city-marker__ring"></span>
        <span class="heritage-city-marker__dot"></span>
      </button>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

const createCityLabelIcon = (city, isSelected) =>
  L.divIcon({
    className: '',
  html: `
      <div class="heritage-city-label ${isSelected ? 'is-selected' : ''}">
        <span>${city.name}</span>
      </div>
    `,
    iconSize: [132, 34],
    iconAnchor: [-20, 32],
  });

const palestineLabelIcon = L.divIcon({
  className: '',
  html: '<div class="heritage-palestine-label">Palestine</div>',
  iconSize: [230, 80],
  iconAnchor: [115, 40],
});

const MapFocus = ({ selectedCity }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedCity?.coordinates) {
      map.flyTo(selectedCity.coordinates, 9, { duration: 0.7 });
    }
  }, [map, selectedCity]);

  return null;
};

const MapTilerEnglishLayer = ({ apiKey }) => {
  const map = useMap();

  useEffect(() => {
    if (!apiKey) {
      return undefined;
    }

    const layer = new MaptilerLayer({
      apiKey,
      language: Language.ENGLISH,
      style: MapStyle.DATAVIZ.LIGHT,
      opacity: 0.72,
    });

    const hideBaseMapLabels = () => {
      const mapTilerMap = layer.getMaptilerSDKMap?.();
      const styleLayers = mapTilerMap?.getStyle?.()?.layers ?? [];

      styleLayers
        .filter((styleLayer) => styleLayer.type === 'symbol')
        .forEach((styleLayer) => {
          try {
            mapTilerMap.setLayoutProperty(styleLayer.id, 'visibility', 'none');
          } catch (_error) {
            // Some provider-managed layers can be unavailable during style transitions.
          }
        });
    };

    layer.on('ready', hideBaseMapLabels);
    layer.addTo(map);

    return () => {
      layer.off('ready', hideBaseMapLabels);
      layer.remove();
    };
  }, [apiKey, map]);

  return null;
};

const ProductMiniCard = ({ product, cityName }) => {
  const productTarget = `/products/${product.slug || product.id || product.productId}`;
  const imageUrl = resolveApiAssetUrl(product.images?.[0] || product.image || '');
  const motifTags = Array.isArray(product.motifTags) ? product.motifTags.filter(Boolean).slice(0, 3) : [];

  return (
    <Link
      to={productTarget}
      className="group grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-[22px] border border-line bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <div className="overflow-hidden rounded-[18px] bg-cream">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="aspect-square h-full w-full bg-blush" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{product.name}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{product.category || 'Athar piece'}</p>
        <p className="mt-2 text-sm font-bold text-ink">{formatCurrency(product.price)}</p>
        <p className="mt-1 text-xs text-ink-soft">From {cityName}</p>
        {motifTags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {motifTags.map((tag) => (
              <span key={tag} className="rounded-full bg-cream px-2 py-1 text-[11px] font-semibold text-ink-soft">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
};

const HeritageMapPage = () => {
  const navigate = useNavigate();
  const [selectedCityId, setSelectedCityId] = useState('jerusalem');
  const [products, setProducts] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');

  const selectedCity = useMemo(
    () => heritageCities.find((city) => city.id === selectedCityId) ?? heritageCities[0],
    [selectedCityId],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadProducts = async () => {
      setIsProductsLoading(true);
      setProductsError('');

      try {
        const response = await apiRequest('/api/products');
        if (!isCancelled) {
          setProducts(normalizeProducts(response?.data ?? []));
        }
      } catch (_error) {
        if (!isCancelled) {
          setProducts([]);
          setProductsError('Products could not be loaded right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsProductsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  const cityProducts = useMemo(
    () =>
      products
        .filter((product) => normalizeCityId(product.inspiredByCity) === selectedCity.id)
        .slice(0, 4),
    [products, selectedCity.id],
  );

  const cityIconLookup = useMemo(
    () =>
      heritageCities.reduce((lookup, city) => {
        lookup[city.id] = createCityIcon(city, city.id === selectedCity.id);
        return lookup;
      }, {}),
    [selectedCity.id],
  );
  const cityLabelIconLookup = useMemo(
    () =>
      heritageCities.reduce((lookup, city) => {
        lookup[city.id] = createCityLabelIcon(city, city.id === selectedCity.id);
        return lookup;
      }, {}),
    [selectedCity.id],
  );

  const handleExploreCollection = () => {
    navigate(`/products?city=${encodeURIComponent(selectedCity.id)}`);
  };

  return (
    <div className="relative z-0 isolate bg-cream">
      <style>{`
        .heritage-city-marker {
          position: relative;
          display: inline-flex;
          height: 38px;
          width: 38px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 999px;
          background: transparent;
          cursor: pointer;
        }

        .heritage-city-marker__ring {
          position: absolute;
          inset: 6px;
          border-radius: 999px;
          border: 2px solid rgba(43, 26, 20, 0.24);
          background: rgba(255, 255, 255, 0.82);
          box-shadow: 0 12px 26px rgba(80, 45, 28, 0.18);
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .heritage-city-marker__dot {
          position: relative;
          height: 10px;
          width: 10px;
          border-radius: 999px;
          background: #6e5548;
          transition: transform 180ms ease, background 180ms ease;
        }

        .heritage-city-marker:hover .heritage-city-marker__ring,
        .heritage-city-marker:focus-visible .heritage-city-marker__ring {
          border-color: #d7a996;
          transform: scale(1.08);
        }

        .heritage-city-marker.is-selected .heritage-city-marker__ring {
          border-color: #d7a996;
          background: rgba(241, 221, 214, 0.92);
          animation: heritage-marker-pulse 1.8s ease-out infinite;
        }

        .heritage-city-marker.is-selected .heritage-city-marker__dot {
          background: #b77b6f;
          transform: scale(1.18);
        }

        .leaflet-container {
          font-family: "Segoe UI", system-ui, sans-serif;
          background: #f8f2ee;
          z-index: 0;
        }

        .leaflet-control-container {
          position: relative;
          z-index: 500;
        }

        .heritage-muted-tiles {
          filter: grayscale(0.94) sepia(0.22) saturate(0.28) contrast(0.68) brightness(1.26);
        }

        .leaflet-tile-pane {
          opacity: ${mapTilerApiKey ? '0.84' : '1'};
        }

        .heritage-map-scrim {
          position: absolute;
          inset: 0;
          z-index: 420;
          background:
            linear-gradient(180deg, rgba(248, 242, 238, 0.18), rgba(248, 242, 238, 0.3)),
            rgba(255, 255, 255, ${mapTilerApiKey ? '0.08' : '0.22'});
          pointer-events: none;
        }

        .heritage-palestine-label {
          width: 230px;
          text-align: center;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 48px;
          line-height: 1;
          color: rgba(43, 26, 20, 0.52);
          letter-spacing: 0;
          text-shadow:
            0 1px 0 rgba(255, 255, 255, 0.9),
            0 14px 34px rgba(80, 45, 28, 0.14);
          pointer-events: none;
          user-select: none;
        }

        .heritage-city-label {
          display: inline-flex;
          min-width: 112px;
          flex-direction: column;
          gap: 1px;
          border-radius: 18px;
          border: 1px solid rgba(215, 169, 150, 0.42);
          background: rgba(255, 255, 255, 0.92);
          padding: 7px 10px;
          color: #2b1a14;
          box-shadow: 0 12px 28px rgba(80, 45, 28, 0.14);
          pointer-events: none;
          user-select: none;
          transform: translateY(-2px);
        }

        .heritage-city-label span {
          display: block;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.1;
          white-space: nowrap;
        }

        .heritage-city-label.is-selected {
          border-color: rgba(183, 123, 111, 0.36);
          background: rgba(248, 242, 238, 0.98);
          color: #6f3d33;
        }

        @keyframes heritage-marker-pulse {
          0% { box-shadow: 0 0 0 0 rgba(183, 123, 111, 0.32), 0 12px 26px rgba(80, 45, 28, 0.18); }
          70% { box-shadow: 0 0 0 12px rgba(183, 123, 111, 0), 0 12px 26px rgba(80, 45, 28, 0.18); }
          100% { box-shadow: 0 0 0 0 rgba(183, 123, 111, 0), 0 12px 26px rgba(80, 45, 28, 0.18); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="section-shell relative z-0 space-y-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="rounded-[32px] border border-line bg-white p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Our Map</p>
            <h1 className="mt-4 font-display text-5xl leading-none text-ink">Stories from Palestine</h1>
            <p className="mt-5 text-base leading-8 text-ink-soft">
              Explore cities rich in history and culture. Each Athar piece is inspired by places, patterns, and stories that shape who we are.
            </p>
            <p className="mt-5 rounded-[22px] bg-cream px-4 py-3 text-sm font-semibold text-ink">
              Click a city marker to explore its story.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 xl:flex-col">
              {heritageCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => setSelectedCityId(city.id)}
                  className={`rounded-full border px-4 py-2 text-left text-sm font-semibold transition ${
                    city.id === selectedCity.id
                      ? 'border-rose bg-blush text-ink'
                      : 'border-line bg-white text-ink-soft hover:border-rose hover:text-ink'
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </aside>

          <section className="relative z-0 isolate min-h-[420px] overflow-hidden rounded-[32px] border border-line bg-white shadow-card">
            <div className="h-[430px] w-full sm:h-[560px] xl:h-full xl:min-h-[640px]">
              <MapContainer
                center={mapCenter}
                zoom={8}
                minZoom={7}
                maxZoom={13}
                maxBounds={palestineBounds}
                maxBoundsViscosity={0.35}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                {mapTilerApiKey ? (
                  <MapTilerEnglishLayer apiKey={mapTilerApiKey} />
                ) : (
                  <TileLayer
                    attribution={openStreetMapTileLayer.attribution}
                    className="heritage-muted-tiles"
                    opacity={openStreetMapTileLayer.opacity}
                    url={openStreetMapTileLayer.url}
                  />
                )}
                <div className="heritage-map-scrim" aria-hidden="true" />
                <MapFocus selectedCity={selectedCity} />
                <Marker position={[31.77, 34.93]} icon={palestineLabelIcon} interactive={false} keyboard={false} zIndexOffset={250} />
                {heritageCities.map((city) => (
                  <Marker
                    key={`${city.id}-label`}
                    position={city.coordinates}
                    icon={cityLabelIconLookup[city.id]}
                    interactive={false}
                    keyboard={false}
                    zIndexOffset={450}
                  />
                ))}
                {heritageCities.map((city) => (
                  <Marker
                    key={city.id}
                    position={city.coordinates}
                    icon={cityIconLookup[city.id]}
                    zIndexOffset={650}
                    eventHandlers={{
                      click: () => setSelectedCityId(city.id),
                      keydown: (event) => {
                        if (event.originalEvent?.key === 'Enter' || event.originalEvent?.key === ' ') {
                          setSelectedCityId(city.id);
                        }
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                      {city.name}
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </section>

          <aside key={selectedCity.id} className="animate-[fadeIn_220ms_ease-out] rounded-[32px] border border-line bg-white p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">City Story</p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink">{selectedCity.name}</h2>
            <p className="mt-2 text-lg font-semibold text-rose">{selectedCity.arabicName}</p>
            <p className="mt-5 text-base leading-8 text-ink-soft">{selectedCity.story}</p>

            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-ink">Motifs / Patterns</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCity.motifs.map((motif) => (
                  <span key={motif} className="rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-semibold text-ink-soft">
                    {motif}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-ink">Products from this city</h3>
                {isProductsLoading ? <span className="text-xs text-ink-soft">Loading...</span> : null}
              </div>

              {productsError ? (
                <div className="mt-3 rounded-[22px] border border-[#e7c8c8] bg-[#fff8f6] px-4 py-3 text-sm text-[#8c6546]">
                  {productsError}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {!isProductsLoading && !productsError && cityProducts.length === 0 ? (
                  <div className="rounded-[22px] border border-line bg-cream px-4 py-5 text-sm leading-7 text-ink-soft">
                    No pieces from this city yet.
                    <Link to="/products" className="mt-3 inline-flex font-bold text-ink">
                      Explore all products
                    </Link>
                  </div>
                ) : null}

                {cityProducts.map((product) => (
                  <ProductMiniCard key={product.id || product.productId} product={product} cityName={selectedCity.name} />
                ))}
              </div>
            </div>

            <button type="button" onClick={handleExploreCollection} className="button-primary mt-7 w-full justify-center">
              Explore Collection
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default HeritageMapPage;
