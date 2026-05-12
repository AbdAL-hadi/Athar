import {
  applyInventoryRecommendation,
  approveInventoryRecommendation,
  generateInventoryRecommendations,
  listInventoryMovements,
  listInventoryRecommendations,
  rejectInventoryRecommendation,
} from '../services/inventoryRecommendationService.js';

const getAdminUserId = (req) => req.user?._id || null;

const sendServiceError = (res, error, fallbackMessage) =>
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });

export const generateAdminInventoryRecommendations = async (req, res) => {
  try {
    const result = await generateInventoryRecommendations({ range: req.body?.range || '7d' });
    const hasRecommendations = result.generatedCount > 0 || result.updatedCount > 0;

    return res.status(200).json({
      success: true,
      message: hasRecommendations
        ? 'Inventory recommendations generated successfully.'
        : 'No inventory recommendations found for this range.',
      ...result,
    });
  } catch (error) {
    console.error('[Athar inventory recommendations] Generate failed:', error.message);
    return sendServiceError(res, error, 'Failed to generate inventory recommendations.');
  }
};

export const getAdminInventoryRecommendations = async (req, res) => {
  try {
    const recommendations = await listInventoryRecommendations({
      status: req.query?.status || 'pending',
      city: req.query?.city || '',
      pressureLevel: req.query?.pressureLevel || '',
      range: req.query?.range || '',
    });

    return res.status(200).json({ success: true, data: recommendations });
  } catch (error) {
    return sendServiceError(res, error, 'Failed to fetch inventory recommendations.');
  }
};

export const approveAdminInventoryRecommendation = async (req, res) => {
  try {
    const recommendation = await approveInventoryRecommendation(req.params.id, getAdminUserId(req));
    return res.status(200).json({
      success: true,
      message: 'Recommendation approved. Stock has not been moved yet.',
      data: recommendation,
    });
  } catch (error) {
    return sendServiceError(res, error, 'Failed to approve inventory recommendation.');
  }
};

export const rejectAdminInventoryRecommendation = async (req, res) => {
  try {
    const recommendation = await rejectInventoryRecommendation(req.params.id, getAdminUserId(req));
    return res.status(200).json({
      success: true,
      message: 'Recommendation rejected.',
      data: recommendation,
    });
  } catch (error) {
    return sendServiceError(res, error, 'Failed to reject inventory recommendation.');
  }
};

export const applyAdminInventoryRecommendation = async (req, res) => {
  try {
    const result = await applyInventoryRecommendation(req.params.id, getAdminUserId(req));
    return res.status(200).json({
      success: true,
      message: 'Inventory transfer applied successfully.',
      data: result,
    });
  } catch (error) {
    return sendServiceError(res, error, 'Failed to apply inventory recommendation.');
  }
};

export const getAdminInventoryMovements = async (req, res) => {
  try {
    const movements = await listInventoryMovements({ limit: req.query?.limit || 50 });
    return res.status(200).json({ success: true, data: movements });
  } catch (error) {
    return sendServiceError(res, error, 'Failed to fetch inventory movement history.');
  }
};
