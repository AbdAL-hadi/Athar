import mongoose from 'mongoose';

const warehouseStockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 3,
      min: 0,
    },
  },
  { timestamps: true },
);

warehouseStockSchema.index({ product: 1, warehouse: 1 }, { unique: true });

const WarehouseStock = mongoose.models.WarehouseStock || mongoose.model('WarehouseStock', warehouseStockSchema);

export default WarehouseStock;
