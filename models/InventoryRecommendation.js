import mongoose from 'mongoose';

const inventoryRecommendationSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productTitle: {
      type: String,
      default: '',
      trim: true,
    },
    productCategory: {
      type: String,
      default: '',
      trim: true,
    },
    demandCity: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    demandCityLabel: {
      type: String,
      default: '',
      trim: true,
    },
    toWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    toWarehouseName: {
      type: String,
      default: '',
      trim: true,
    },
    toWarehouseCity: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    fromWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    fromWarehouseName: {
      type: String,
      default: '',
      trim: true,
    },
    fromWarehouseCity: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    suggestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    cityDemandScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    destinationStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    sourceStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    pressureLevel: {
      type: String,
      enum: ['medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    aiExplanation: {
      type: String,
      default: null,
      trim: true,
    },
    calculationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'applied', 'expired'],
      default: 'pending',
      index: true,
    },
    demoSeed: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    appliedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

inventoryRecommendationSchema.index({ status: 1, createdAt: -1 });
inventoryRecommendationSchema.index({ demandCity: 1, status: 1 });
inventoryRecommendationSchema.index({ product: 1, status: 1 });
inventoryRecommendationSchema.index({ fromWarehouse: 1, toWarehouse: 1 });
inventoryRecommendationSchema.index({ pressureLevel: 1, status: 1 });

const InventoryRecommendation =
  mongoose.models.InventoryRecommendation ||
  mongoose.model('InventoryRecommendation', inventoryRecommendationSchema);

export default InventoryRecommendation;
