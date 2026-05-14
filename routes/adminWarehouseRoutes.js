import { Router } from 'express';
import {
  getProductWarehouseStock,
  getWarehouseInventory,
  getWarehouseInventoryAnalysis,
  getWarehouses,
  getWarehouseStock,
  updateProductWarehouseStock,
} from '../controllers/adminWarehouseController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/warehouses', protect, requireAdmin, getWarehouses);
router.get('/warehouse-stock', protect, requireAdmin, getWarehouseStock);
router.get('/inventory', protect, requireAdmin, getWarehouseInventory);
router.get('/inventory-analysis', protect, requireAdmin, getWarehouseInventoryAnalysis);
router.get('/products/:productId/warehouse-stock', protect, requireAdmin, getProductWarehouseStock);
router.put('/products/:productId/warehouse-stock', protect, requireAdmin, updateProductWarehouseStock);

export default router;
