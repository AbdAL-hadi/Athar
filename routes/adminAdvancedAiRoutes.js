import { Router } from 'express';
import {
  generateAdvancedBusinessSummary,
  generateAdvancedCampaignSuggestions,
  getAdvancedCityPersonalization,
  getAdvancedDemandForecast,
  getAdvancedMarketingOpportunities,
  getAdvancedProductContentAudit,
  getAdvancedRiskAlerts,
} from '../controllers/adminAdvancedAiController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/demand-forecast', protect, requireAdmin, getAdvancedDemandForecast);
router.post('/business-summary', protect, requireAdmin, generateAdvancedBusinessSummary);
router.get('/marketing-opportunities', protect, requireAdmin, getAdvancedMarketingOpportunities);
router.post('/campaign-suggestions', protect, requireAdmin, generateAdvancedCampaignSuggestions);
router.get('/product-content-audit', protect, requireAdmin, getAdvancedProductContentAudit);
router.get('/city-personalization', protect, requireAdmin, getAdvancedCityPersonalization);
router.get('/risk-alerts', protect, requireAdmin, getAdvancedRiskAlerts);

export default router;
