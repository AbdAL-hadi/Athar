import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'Palestine' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationCodeHash: {
      type: String,
      default: '',
      select: false,
    },
    emailVerificationCodeExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    lastVerificationSentAt: {
      type: Date,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'employee', 'delivery'],
      default: 'customer',
    },
    deliveryCity: {
      type: String,
      trim: true,
      default: '',
    },
    favorites: {
      type: [String],
      default: [],
    },
    profilePicture: {
      type: String,
      default: '',
    },
    atharPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    rewardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeLoyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    accountRewardGranted: {
      type: Boolean,
      default: false,
    },
    demoSeed: {
      type: Boolean,
      default: false,
      index: true,
    },
    firstOrderRewardGranted: {
      type: Boolean,
      default: false,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
