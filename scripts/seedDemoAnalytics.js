import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import InventoryMovement from '../models/InventoryMovement.js';
import InventoryRecommendation from '../models/InventoryRecommendation.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { normalizeCityValue } from '../constants/palestinianCities.js';
import { hashPassword } from '../utils/auth.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_PASSWORD = 'DemoAnalytics@123';
const DEMO_USER_SPECS = [
  { city: 'nablus', cityLabel: 'Nablus', email: 'demo.nablus@athar.local', name: 'Demo Nablus Customer' },
  { city: 'hebron', cityLabel: 'Hebron', email: 'demo.hebron@athar.local', name: 'Demo Hebron Customer' },
  { city: 'gaza', cityLabel: 'Gaza', email: 'demo.gaza@athar.local', name: 'Demo Gaza Customer' },
  { city: 'ramallah', cityLabel: 'Ramallah', email: 'demo.ramallah@athar.local', name: 'Demo Ramallah Customer' },
];
const REQUIRED_WAREHOUSE_CITIES = ['nablus', 'hebron', 'gaza'];

let eventSequence = 0;

const normalizeText = (value = '') => String(value ?? '').trim();

const eventCreatedAt = () => {
  const now = new Date();
  const daysAgo = eventSequence % 7;
  const minutesAgo = (eventSequence % 24) * 37;
  eventSequence += 1;
  return new Date(now.getTime() - daysAgo * DAY_MS - minutesAgo * 60 * 1000);
};

const findProductByPreference = (products, predicate, fallbackIndex = 0) =>
  products.find(predicate) || products[fallbackIndex % products.length] || products[0];

const uniqProducts = (products) => {
  const seen = new Set();
  return products.filter((product) => {
    const id = String(product?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const ensureDemoUsers = async () => {
  const password = await hashPassword(DEMO_PASSWORD);
  const usersByCity = new Map();

  for (const spec of DEMO_USER_SPECS) {
    const city = normalizeCityValue(spec.city);
    const user = await User.findOneAndUpdate(
      { email: spec.email },
      {
        $set: {
          name: spec.name,
          email: spec.email,
          phone: '+970000000000',
          role: 'customer',
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          demoSeed: true,
          address: {
            line1: 'Demo analytics address',
            city,
            postalCode: '0000',
            country: 'Palestine',
          },
        },
        $setOnInsert: {
          password,
          favorites: [],
        },
      },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    usersByCity.set(city, user);
  }

  return usersByCity;
};

const buildBaseEvent = ({ eventType, city, user, product = null, metadata = {}, searchQuery = '', quantity = 1 }) => {
  const createdAt = eventCreatedAt();

  return {
    eventType,
    user: user?._id || null,
    sessionId: `demo-${city}-${createdAt.getTime()}-${eventSequence}`,
    userCity: city,
    product: product?._id || null,
    productTitle: product?.title || '',
    productCategory: product?.category || '',
    productPrice: product?.price ?? null,
    quantity,
    searchQuery,
    sourcePage: product?.slug ? `/products/${product.slug}` : '/products',
    metadata,
    demoSeed: true,
    createdAt,
  };
};

const pushRepeatedEvents = (events, { eventType, count, city, usersByCity, product, metadata = {}, quantity = 1 }) => {
  for (let index = 0; index < count; index += 1) {
    const resolvedMetadata = typeof metadata === 'function' ? metadata(index) : metadata;
    events.push(
      buildBaseEvent({
        eventType,
        city,
        user: usersByCity.get(city),
        product,
        quantity,
        metadata: {
          demoScenario: true,
          ...resolvedMetadata,
        },
      }),
    );
  }
};

const buildDemoEvents = ({ productsByScenario, usersByCity }) => {
  const events = [];
  const { bagProduct, ringProduct, walletProduct, ramallahProduct } = productsByScenario;

  [
    ['product_view', 22],
    ['add_to_cart', 7],
    ['favorite_add', 4],
    ['purchase', 2],
    ['try_on_generate', 3],
  ].forEach(([eventType, count]) =>
    pushRepeatedEvents(events, {
      eventType,
      count,
      city: 'nablus',
      usersByCity,
      product: bagProduct,
      metadata: (index) =>
        eventType === 'try_on_generate'
          ? { status: 'success', style: index % 2 ? 'studio fashion' : 'realistic', productType: 'bag' }
          : { status: 'tracked' },
    }),
  );

  [
    ['product_view', 9],
    ['add_to_cart', 3],
    ['favorite_add', 2],
    ['purchase', 1],
    ['try_on_generate', 3],
  ].forEach(([eventType, count]) =>
    pushRepeatedEvents(events, {
      eventType,
      count,
      city: 'hebron',
      usersByCity,
      product: ringProduct,
      metadata: eventType === 'try_on_generate'
        ? { status: 'success', style: 'realistic', productType: 'ring' }
        : { status: 'tracked' },
    }),
  );

  [
    ['product_view', 8],
    ['add_to_cart', 3],
    ['favorite_add', 2],
    ['visual_search', 1],
  ].forEach(([eventType, count]) =>
    pushRepeatedEvents(events, {
      eventType,
      count,
      city: 'gaza',
      usersByCity,
      product: walletProduct,
      metadata: eventType === 'visual_search'
        ? { status: 'success', detectedTags: ['wallet', 'leather'], resultsCount: 3 }
        : { status: 'tracked' },
    }),
  );

  [
    ['product_view', 10],
    ['add_to_cart', 5],
    ['favorite_add', 2],
    ['try_on_generate', 4],
  ].forEach(([eventType, count]) =>
    pushRepeatedEvents(events, {
      eventType,
      count,
      city: 'ramallah',
      usersByCity,
      product: ramallahProduct,
      metadata: eventType === 'try_on_generate'
        ? {
            status: count > 2 ? 'failed' : 'success',
            style: 'studio fashion',
            productType: /watch/i.test(ramallahProduct.category) ? 'watch' : 'sunglasses',
            reason: 'low_quality_photo',
          }
        : { status: 'tracked' },
    }),
  );

  const searches = [
    { query: 'bag', count: 2, city: 'nablus', resultsCount: 5 },
    { query: 'ring', count: 2, city: 'hebron', resultsCount: 4 },
    { query: 'watch', count: 2, city: 'ramallah', resultsCount: 3 },
    { query: 'wallet', count: 1, city: 'gaza', resultsCount: 2 },
    { query: 'sunglasses', count: 1, city: 'ramallah', resultsCount: 2 },
    { query: 'olive', count: 1, city: 'nablus', resultsCount: 2 },
    { query: 'leather bag', count: 1, city: 'nablus', resultsCount: 4 },
    { query: 'copper ring', count: 1, city: 'hebron', resultsCount: 1 },
    { query: 'tatreez', count: 3, city: 'gaza', resultsCount: 0 },
    { query: 'gold bracelet', count: 3, city: 'ramallah', resultsCount: 0 },
  ];

  searches.forEach((item) => {
    for (let index = 0; index < item.count; index += 1) {
      events.push(
        buildBaseEvent({
          eventType: 'search',
          city: item.city,
          user: usersByCity.get(item.city),
          searchQuery: item.query,
          metadata: {
            demoScenario: true,
            resultsCount: item.resultsCount,
            normalizedQuery: item.query,
          },
        }),
      );
    }
  });

  const visualSearches = [
    { city: 'nablus', product: bagProduct, status: 'success', tags: ['bag', 'tatreez'], resultsCount: 4 },
    { city: 'hebron', product: ringProduct, status: 'success', tags: ['ring', 'copper'], resultsCount: 3 },
    { city: 'gaza', product: walletProduct, status: 'failed', tags: [], resultsCount: 0 },
    { city: 'ramallah', product: ramallahProduct, status: 'failed', tags: [], resultsCount: 0 },
    { city: 'ramallah', product: ramallahProduct, status: 'failed', tags: [], resultsCount: 0 },
    { city: 'nablus', product: bagProduct, status: 'success', tags: ['leather', 'bag'], resultsCount: 5 },
  ];

  visualSearches.forEach((item) => {
    events.push(
      buildBaseEvent({
        eventType: 'visual_search',
        city: item.city,
        user: usersByCity.get(item.city),
        product: item.product,
        metadata: {
          demoScenario: true,
          status: item.status,
          detectedTags: item.tags,
          resultsCount: item.resultsCount,
          reason: item.status === 'failed' ? 'low_confidence_match' : '',
        },
      }),
    );
  });

  [
    { city: 'nablus', product: bagProduct, rating: 5 },
    { city: 'hebron', product: ringProduct, rating: 4 },
    { city: 'gaza', product: walletProduct, rating: 3 },
    { city: 'ramallah', product: ramallahProduct, rating: 4 },
  ].forEach((item) => {
    events.push(
      buildBaseEvent({
        eventType: 'review_create',
        city: item.city,
        user: usersByCity.get(item.city),
        product: item.product,
        metadata: {
          demoScenario: true,
          status: 'approved',
          hasRating: true,
          rating: item.rating,
        },
      }),
    );
  });

  return events;
};

const ensureWarehousePressureScenario = async ({ product, warehousesByCity }) => {
  const quantitiesByCity = { nablus: 1, hebron: 20, gaza: 8 };
  const warehouseIds = REQUIRED_WAREHOUSE_CITIES.map((city) => warehousesByCity.get(city)?._id).filter(Boolean);
  const previousRows = await WarehouseStock.find({ product: product._id, warehouse: { $in: warehouseIds } })
    .populate('warehouse', 'city name')
    .lean();
  const previousByCity = new Map(previousRows.map((row) => [row.warehouse?.city, Number(row.quantity || 0)]));

  for (const [city, quantity] of Object.entries(quantitiesByCity)) {
    const warehouse = warehousesByCity.get(city);
    await WarehouseStock.findOneAndUpdate(
      { product: product._id, warehouse: warehouse._id },
      {
        $set: {
          quantity,
          reservedQuantity: 0,
          lowStockThreshold: 3,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const allProductStocks = await WarehouseStock.find({ product: product._id }).lean();
  const totalStock = allProductStocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0);
  await Product.updateOne({ _id: product._id }, { $set: { stock: totalStock } });

  return {
    productId: String(product._id),
    productTitle: product.title,
    previousQuantities: Object.fromEntries(
      REQUIRED_WAREHOUSE_CITIES.map((city) => [city, previousByCity.has(city) ? previousByCity.get(city) : null]),
    ),
    newQuantities: quantitiesByCity,
    syncedProductStock: totalStock,
  };
};

const createMovementHistoryDemo = async ({ product, warehousesByCity }) => {
  const movement = new InventoryMovement({
    product: product._id,
    fromWarehouse: warehousesByCity.get('gaza')._id,
    toWarehouse: warehousesByCity.get('hebron')._id,
    quantity: 3,
    reason: 'Demo movement history for analytics presentation. Stock was not changed by this audit-only seed.',
    demoSeed: true,
    createdAt: new Date(Date.now() - 2 * DAY_MS),
  });

  await movement.save({ timestamps: false });
  return movement;
};

const run = async () => {
  await connectDB();

  const [products, warehouses] = await Promise.all([
    Product.find().sort({ title: 1 }).select('title slug category price stock lowStockThreshold').lean(),
    Warehouse.find({ isActive: true }).sort({ city: 1 }).lean(),
  ]);

  if (products.length === 0) {
    console.log('No products found. Run npm run seed:products or add products before seeding demo analytics.');
    return;
  }

  const warehousesByCity = new Map(warehouses.map((warehouse) => [normalizeCityValue(warehouse.city), warehouse]));
  const missingWarehouseCities = REQUIRED_WAREHOUSE_CITIES.filter((city) => !warehousesByCity.has(city));

  if (missingWarehouseCities.length > 0) {
    console.log(`Missing required warehouses for: ${missingWarehouseCities.join(', ')}. Run npm run seed:warehouses first.`);
    return;
  }

  const bagProduct = findProductByPreference(products, (product) => product.category === 'Bags', 0);
  const ringProduct = findProductByPreference(products, (product) => product.category === 'Rings', 1);
  const walletProduct = findProductByPreference(products, (product) => product.category === 'Wallets', 2);
  const ramallahProduct = findProductByPreference(
    products,
    (product) => /sunglasses/i.test(`${product.title} ${product.category}`) || product.category === 'Watches',
    3,
  );
  const selectedProducts = uniqProducts([bagProduct, ringProduct, walletProduct, ramallahProduct]);

  const usersByCity = await ensureDemoUsers();
  const cleanup = {
    behaviorEvents: (await UserBehaviorEvent.deleteMany({ demoSeed: true })).deletedCount || 0,
    inventoryRecommendations: (await InventoryRecommendation.deleteMany({ demoSeed: true })).deletedCount || 0,
    inventoryMovements: (await InventoryMovement.deleteMany({ demoSeed: true })).deletedCount || 0,
  };

  const events = buildDemoEvents({
    productsByScenario: { bagProduct, ringProduct, walletProduct, ramallahProduct },
    usersByCity,
  });

  await UserBehaviorEvent.insertMany(events, { ordered: true });
  const warehousePressure = await ensureWarehousePressureScenario({ product: bagProduct, warehousesByCity });
  const movement = await createMovementHistoryDemo({ product: bagProduct, warehousesByCity });

  const eventCounts = events.reduce((counts, event) => {
    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    return counts;
  }, {});

  console.log(
    JSON.stringify(
      {
        cleanup,
        insertedBehaviorEvents: events.length,
        eventCounts,
        demoUsers: DEMO_USER_SPECS.map(({ city, email }) => ({ city, email })),
        selectedProducts: {
          nablusBags: { id: String(bagProduct._id), title: bagProduct.title, category: bagProduct.category },
          hebronRings: { id: String(ringProduct._id), title: ringProduct.title, category: ringProduct.category },
          gazaWallets: { id: String(walletProduct._id), title: walletProduct.title, category: walletProduct.category },
          ramallahInterest: { id: String(ramallahProduct._id), title: ramallahProduct.title, category: ramallahProduct.category },
        },
        warehousePressure,
        movementHistorySeeded: {
          id: String(movement._id),
          quantity: movement.quantity,
          stockChangedByMovementRecord: false,
        },
        warning:
          'WarehouseStock was intentionally updated only for the selected Nablus bag pressure product. Previous quantities are shown above.',
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error('Demo analytics seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
