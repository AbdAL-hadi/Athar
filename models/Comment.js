import mongoose from 'mongoose';

const moderationDetailsSchema = new mongoose.Schema(
  {
    aiScore: { type: Number, default: 0, min: 0, max: 100 },
    ruleScore: { type: Number, default: 0, min: 0, max: 100 },
    matchedRules: { type: [String], default: [] },
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    productTitle: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    status: {
      type: String,
      enum: ['approved', 'rejected', 'pending'],
      default: 'pending',
      index: true,
    },
    moderationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    moderationDecision: {
      type: String,
      enum: ['approved', 'rejected', 'pending'],
      default: 'pending',
    },
    moderationReason: {
      type: String,
      default: '',
      trim: true,
    },
    moderationLabels: {
      type: [String],
      default: [],
    },
    moderationDetails: {
      type: moderationDetailsSchema,
      default: () => ({}),
    },
    reviewedBy: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rewardPointsGranted: {
      type: Boolean,
      default: false,
    },
    rewardPointsGrantedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

export default Comment;
