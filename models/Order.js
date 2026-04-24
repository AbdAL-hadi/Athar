import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    fulfilledQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'Palestine' },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    orderNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one order item is required.',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash on Delivery'],
      default: 'Cash on Delivery',
    },
    address: {
      type: shippingAddressSchema,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    inventoryApplied: {
      type: Boolean,
      default: false,
    },
    inventoryAppliedAt: {
      type: Date,
      default: null,
    },
    inventoryRestoredAt: {
      type: Date,
      default: null,
    },
    deliveryConfirmedByCustomer: {
      type: Boolean,
      default: false,
    },
    deliveryConfirmedAt: {
      type: Date,
      default: null,
    },
    deliveryConfirmationMessage: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default Order;
