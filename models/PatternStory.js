import mongoose from 'mongoose';

const patternStorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    image: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    productCode: {
      type: String,
      default: '',
      trim: true,
    },
    motifTags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

const PatternStory = mongoose.models.PatternStory || mongoose.model('PatternStory', patternStorySchema);

export default PatternStory;
