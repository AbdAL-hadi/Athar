import {
  getBusinessSummary,
  getCampaignSuggestions,
  getCityPersonalizationIdeas,
  getDemandForecast,
  getMarketingOpportunities,
  getProductContentAudit,
  getRiskAlerts,
} from '../services/advancedAiAnalyticsService.js';

const sendError = (res, error, message) =>
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || message,
  });

export const getAdvancedDemandForecast = async (req, res) => {
  try {
    const data = await getDemandForecast({ range: req.query?.range || '7d' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to calculate demand forecast.');
  }
};

export const generateAdvancedBusinessSummary = async (req, res) => {
  try {
    const data = await getBusinessSummary({
      range: req.body?.range || req.query?.range || '7d',
      forceRegenerate: Boolean(req.body?.forceRegenerate),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to generate business summary.');
  }
};

export const getAdvancedMarketingOpportunities = async (req, res) => {
  try {
    const data = await getMarketingOpportunities({ range: req.query?.range || '7d' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to calculate marketing opportunities.');
  }
};

export const generateAdvancedCampaignSuggestions = async (req, res) => {
  try {
    const data = await getCampaignSuggestions({
      range: req.body?.range || req.query?.range || '7d',
      forceRegenerate: Boolean(req.body?.forceRegenerate),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to generate campaign suggestions.');
  }
};

export const getAdvancedProductContentAudit = async (_req, res) => {
  try {
    const data = await getProductContentAudit();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to calculate product content audit.');
  }
};

export const getAdvancedCityPersonalization = async (req, res) => {
  try {
    const data = await getCityPersonalizationIdeas({ range: req.query?.range || '7d' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to calculate city personalization ideas.');
  }
};

export const getAdvancedRiskAlerts = async (req, res) => {
  try {
    const data = await getRiskAlerts({ range: req.query?.range || '7d' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Failed to calculate risk alerts.');
  }
};
