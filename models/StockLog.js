import mongoose from 'mongoose';

const stockLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    quantityChanged: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    nextStock: {
      type: Number,
      required: true,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      enum: ['order-confirmed', 'order-cancelled', 'order-refunded', 'manual-restock'],
      required: true,
    },
  },
  { timestamps: true },
);

const StockLog = mongoose.models.StockLog || mongoose.model('StockLog', stockLogSchema);

export default StockLog;
