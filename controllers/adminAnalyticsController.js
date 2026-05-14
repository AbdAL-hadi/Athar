import {
  getAiToolAnalytics,
  getCityDemandAnalytics,
  getCustomerBehaviorFunnelAnalytics,
  getDateRange,
  getOverviewAnalytics,
  getProductDemandAnalytics,
  getSearchAnalytics,
  getWarehouseAnalytics,
} from '../services/adminAnalyticsService.js';

const buildDateRange = (req) =>
  getDateRange({
    range: req.query?.range,
    from: req.query?.from,
    to: req.query?.to,
  });

const sendAnalytics = async (req, res, loader, failureMessage) => {
  try {
    const dateRange = buildDateRange(req);
    const data = await loader(dateRange);

    return res.status(200).json({
      success: true,
      range: {
        key: dateRange.key,
        from: dateRange.from,
        to: dateRange.to,
      },
      data,
    });
  } catch (error) {
    console.error(`[Athar analytics] ${failureMessage}:`, error.message);
    return res.status(500).json({
      success: false,
      message: failureMessage,
    });
  }
};

export const getAdminAnalyticsOverview = (req, res) =>
  sendAnalytics(req, res, getOverviewAnalytics, 'Failed to fetch overview analytics.');

export const getAdminAnalyticsProducts = (req, res) =>
  sendAnalytics(req, res, getProductDemandAnalytics, 'Failed to fetch product demand analytics.');

export const getAdminAnalyticsCities = (req, res) =>
  sendAnalytics(req, res, getCityDemandAnalytics, 'Failed to fetch city demand analytics.');

export const getAdminAnalyticsWarehouses = (req, res) =>
  sendAnalytics(req, res, getWarehouseAnalytics, 'Failed to fetch warehouse analytics.');

export const getAdminAnalyticsSearches = (req, res) =>
  sendAnalytics(req, res, getSearchAnalytics, 'Failed to fetch search analytics.');

export const getAdminAnalyticsAiTools = (req, res) =>
  sendAnalytics(req, res, getAiToolAnalytics, 'Failed to fetch AI tool usage analytics.');

export const getAdminAnalyticsCustomerFunnel = (req, res) =>
  sendAnalytics(req, res, getCustomerBehaviorFunnelAnalytics, 'Failed to fetch customer behavior funnel analytics.');
