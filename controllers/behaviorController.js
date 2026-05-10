import mongoose from 'mongoose';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import { getDateRange } from '../services/adminAnalyticsService.js';
import { buildBehaviorEventPayload } from '../services/behaviorEventService.js';
import { normalizeCityValue } from '../constants/palestinianCities.js';

const parseDate = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const serializeEvent = (event) => ({
  id: event._id?.toString?.() ?? '',
  eventType: event.eventType,
  user: event.user?._id?.toString?.() ?? event.user?.toString?.() ?? '',
  sessionId: event.sessionId,
  userCity: event.userCity,
  product: event.product?._id?.toString?.() ?? event.product?.toString?.() ?? '',
  productTitle: event.productTitle,
  productCategory: event.productCategory,
  productPrice: event.productPrice,
  quantity: event.quantity,
  searchQuery: event.searchQuery,
  sourcePage: event.sourcePage,
  metadata: event.metadata || {},
  createdAt: event.createdAt,
});

export const trackBehavior = async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || req.headers['x-athar-session-id'] || '';
    const eventPayload = await buildBehaviorEventPayload({
      body: req.body,
      user: req.user,
      sessionId,
    });

    await UserBehaviorEvent.create(eventPayload);

    return res.status(200).json({ success: true });
  } catch (error) {
    const status = error.statusCode || 500;

    if (status >= 500) {
      console.error('[Athar behavior] Track endpoint failed:', error.message);
      return res.status(200).json({ success: true });
    }

    return res.status(status).json({
      success: false,
      message: error.message || 'Invalid behavior event.',
    });
  }
};

export const getAdminBehaviorEvents = async (req, res) => {
  try {
    const query = {};
    const { eventType, city, productId, from, to, range } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);

    if (eventType) query.eventType = String(eventType).trim();
    if (city) query.userCity = normalizeCityValue(city);
    if (productId && mongoose.isValidObjectId(productId)) query.product = productId;

    const dateRange = getDateRange({ range, from, to });
    const fromDate = dateRange.from || parseDate(from);
    const toDate = dateRange.to || parseDate(to);

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = fromDate;
      if (toDate) query.createdAt.$lte = toDate;
    }

    const events = await UserBehaviorEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'name email')
      .populate('product', 'title category')
      .lean();

    return res.status(200).json({
      success: true,
      data: events.map(serializeEvent),
    });
  } catch (error) {
    console.error('[Athar behavior] Admin events fetch failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch behavior events.',
    });
  }
};

export const getAdminBehaviorSummary = async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };
    const groupCount = async (idExpression, extraMatch = {}, limit = 10) =>
      UserBehaviorEvent.aggregate([
        { $match: { ...match, ...extraMatch } },
        { $group: { _id: idExpression, count: { $sum: 1 } } },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);

    const [eventsByType, topProducts, topCartProducts, topCities, topCategories, topSearchQueries] =
      await Promise.all([
        groupCount('$eventType', {}, 20),
        groupCount('$productTitle', { eventType: 'product_view' }),
        groupCount('$productTitle', { eventType: 'add_to_cart' }),
        groupCount('$userCity'),
        groupCount('$productCategory'),
        groupCount('$searchQuery', { eventType: 'search' }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        eventsByType,
        topProducts,
        topAddedToCartProducts: topCartProducts,
        topCities,
        topCategories,
        topSearchQueries,
      },
    });
  } catch (error) {
    console.error('[Athar behavior] Admin summary failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch behavior summary.',
    });
  }
};
