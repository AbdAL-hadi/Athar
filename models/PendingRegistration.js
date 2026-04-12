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

const pendingRegistrationSchema = new mongoose.Schema(
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
      index: true,
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
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    verificationCodeHash: {
      type: String,
      required: true,
      select: false,
    },
    verificationCodeExpiresAt: {
      type: Date,
      required: true,
      select: false,
    },
    lastVerificationSentAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true },
);

const PendingRegistration =
  mongoose.models.PendingRegistration ||
  mongoose.model('PendingRegistration', pendingRegistrationSchema);

export default PendingRegistration;
