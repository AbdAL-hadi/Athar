import mongoose from 'mongoose';

const aiGeneratedInsightSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['business_summary', 'campaign_suggestions'],
      index: true,
    },
    range: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fingerprint: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    payloadSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    output: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    usedAI: {
      type: Boolean,
      default: false,
    },
    fallback: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

aiGeneratedInsightSchema.index({ type: 1, range: 1, fingerprint: 1 });
aiGeneratedInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AiGeneratedInsight =
  mongoose.models.AiGeneratedInsight || mongoose.model('AiGeneratedInsight', aiGeneratedInsightSchema);

export default AiGeneratedInsight;
