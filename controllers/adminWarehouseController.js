import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { upsertProductWarehouseStocks } from '../services/inventoryService.js';

const serializeStock = (stock) => ({
  id: stock._id?.toString(),
  product: stock.product,
  warehouse: stock.warehouse,
  quantity: Number(stock.quantity || 0),
  reservedQuantity: Number(stock.reservedQuantity || 0),
  lowStockThreshold: Number(stock.lowStockThreshold || 0),
});

export const getWarehouses = async (_req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ cityLabel: 1, name: 1 }).lean();
    return res.status(200).json({ success: true, data: warehouses });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch warehouses.', error: error.message });
  }
};

export const getWarehouseStock = async (req, res) => {
  try {
    const { productId, warehouseId } = req.query;
    const query = {};

    if (productId) {
      if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });
      query.product = productId;
    }

    if (warehouseId) {
      if (!mongoose.isValidObjectId(warehouseId)) return res.status(400).json({ success: false, message: 'Invalid warehouse ID.' });
      query.warehouse = warehouseId;
    }

    const stocks = await WarehouseStock.find(query)
      .populate('product', 'title category stock lowStockThreshold inventoryStatus')
      .populate('warehouse')
      .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, data: stocks.map(serializeStock) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch warehouse stock.', error: error.message });
  }
};

export const getProductWarehouseStock = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }

    const product = await Product.findById(productId).select('title category stock lowStockThreshold inventoryStatus').lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const [warehouses, stockRows] = await Promise.all([
      Warehouse.find().sort({ cityLabel: 1, name: 1 }).lean(),
      WarehouseStock.find({ product: productId }).lean(),
    ]);
    const stockByWarehouse = new Map(stockRows.map((stock) => [stock.warehouse.toString(), stock]));
    const stocks = warehouses.map((warehouse) => {
      const stock = stockByWarehouse.get(warehouse._id.toString());

      return {
        warehouse,
        quantity: Number(stock?.quantity || 0),
        reservedQuantity: Number(stock?.reservedQuantity || 0),
        lowStockThreshold: Number(stock?.lowStockThreshold ?? 3),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        product,
        stocks,
        totalStock: Number(product.stock || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch product warehouse stock.', error: error.message });
  }
};

export const updateProductWarehouseStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await upsertProductWarehouseStocks({
      productId,
      stocks: req.body?.stocks ?? [],
    });

    return res.status(200).json({
      success: true,
      message: 'Warehouse stock updated successfully.',
      data: product,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update product warehouse stock.',
    });
  }
};

export const getWarehouseInventory = async (_req, res) => {
  try {
    const [warehouses, products, stockRows] = await Promise.all([
      Warehouse.find().sort({ cityLabel: 1, name: 1 }).lean(),
      Product.find().select('title category stock inventoryStatus lowStockThreshold').sort({ title: 1 }).lean(),
      WarehouseStock.find().lean(),
    ]);
    const stockByProductWarehouse = new Map(
      stockRows.map((stock) => [`${stock.product.toString()}:${stock.warehouse.toString()}`, stock]),
    );

    const rows = products.map((product) => {
      const warehouseStocks = warehouses.map((warehouse) => {
        const stock = stockByProductWarehouse.get(`${product._id.toString()}:${warehouse._id.toString()}`);

        return {
          warehouseId: warehouse._id.toString(),
          warehouseName: warehouse.name,
          city: warehouse.city,
          cityLabel: warehouse.cityLabel,
          quantity: Number(stock?.quantity || 0),
          lowStockThreshold: Number(stock?.lowStockThreshold ?? 3),
        };
      });
      const total = warehouseStocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const combinedThreshold = warehouseStocks.reduce((sum, stock) => sum + stock.lowStockThreshold, 0);
      const displayTotal = stockRows.some((stock) => stock.product.toString() === product._id.toString()) ? total : Number(product.stock || 0);
      const status =
        displayTotal <= 0
          ? 'Out of stock'
          : displayTotal <= Math.max(3, combinedThreshold)
            ? 'Low stock'
            : 'In stock';

      return {
        productId: product._id.toString(),
        title: product.title,
        category: product.category,
        total: displayTotal,
        status,
        warehouseStocks,
      };
    });

    return res.status(200).json({ success: true, data: { warehouses, rows } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch warehouse inventory.', error: error.message });
  }
};
