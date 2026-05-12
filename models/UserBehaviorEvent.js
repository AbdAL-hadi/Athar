import mongoose from 'mongoose';

export const BEHAVIOR_EVENT_TYPES = [
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'favorite_add',
  'favorite_remove',
  'search',
  'visual_search',
  'try_on_generate',
  'purchase',
  'review_create',
];

const userBehaviorEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: BEHAVIOR_EVENT_TYPES,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    userCity: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
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
      index: true,
    },
    productPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    searchQuery: {
      type: String,
      default: '',
      trim: true,
    },
    sourcePage: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    demoSeed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

userBehaviorEventSchema.index({ eventType: 1, createdAt: -1 });
userBehaviorEventSchema.index({ userCity: 1, createdAt: -1 });
userBehaviorEventSchema.index({ product: 1, createdAt: -1 });
userBehaviorEventSchema.index({ productCategory: 1, createdAt: -1 });
userBehaviorEventSchema.index({ user: 1, createdAt: -1 });
userBehaviorEventSchema.index({ sessionId: 1, createdAt: -1 });

const UserBehaviorEvent =
  mongoose.models.UserBehaviorEvent || mongoose.model('UserBehaviorEvent', userBehaviorEventSchema);

export default UserBehaviorEvent;
