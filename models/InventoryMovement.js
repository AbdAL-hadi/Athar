import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    fromWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    toWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryRecommendation',
      default: null,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    demoSeed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inventoryMovementSchema.index({ createdAt: -1 });
inventoryMovementSchema.index({ fromWarehouse: 1, toWarehouse: 1, createdAt: -1 });

const InventoryMovement =
  mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', inventoryMovementSchema);

export default InventoryMovement;
