import mongoose from 'mongoose';

const visualDescriptionLanguageSchema = new mongoose.Schema(
  {
    short: {
      type: String,
      default: '',
      trim: true,
    },
    long: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const audioDescriptionLanguageSchema = new mongoose.Schema(
  {
    shortUrl: {
      type: String,
      default: '',
      trim: true,
    },
    longUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const trackedVisualFields = ['title', 'description', 'category', 'material', 'images'];

const clearAudioDescriptionUrls = (audioDescriptions = {}) => {
  audioDescriptions.en = audioDescriptions.en ?? {};
  audioDescriptions.ar = audioDescriptions.ar ?? {};

  audioDescriptions.en.shortUrl = '';
  audioDescriptions.en.longUrl = '';
  audioDescriptions.ar.shortUrl = '';
  audioDescriptions.ar.longUrl = '';
};

const productSchema = new mongoose.Schema(
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one product image is required.',
      },
    },
    category: {
      type: String,
      required: true,
      enum: ['Bags', 'Bracelets', 'Rings', 'Wallets', 'Accessories', 'Watches'],
    },
    material: {
      type: String,
      required: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
    },
    lowStockFlag: {
      type: Boolean,
      default: false,
    },
    inventoryStatus: {
      type: String,
      enum: ['OK', 'Low', 'Critical', 'Out of Stock'],
      default: 'OK',
    },
    lastRestockDate: {
      type: Date,
      default: null,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    visualDescriptions: {
      en: {
        type: visualDescriptionLanguageSchema,
        default: () => ({}),
      },
      ar: {
        type: visualDescriptionLanguageSchema,
        default: () => ({}),
      },
    },
    audioDescriptions: {
      en: {
        type: audioDescriptionLanguageSchema,
        default: () => ({}),
      },
      ar: {
        type: audioDescriptionLanguageSchema,
        default: () => ({}),
      },
    },
    visualDescriptionStatus: {
      type: String,
      enum: ['not_generated', 'generated', 'failed'],
      default: 'not_generated',
    },
    visualDescriptionUpdatedAt: {
      type: Date,
      default: null,
    },
    visualDescriptionNeedsRefresh: {
      type: Boolean,
      default: true,
    },
    styleTags: {
      type: [String],
      default: [],
    },
    occasionTags: {
      type: [String],
      default: [],
    },
    dominantColors: {
      type: [String],
      default: [],
    },
    visualTraits: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => !Array.isArray(value) || value.length <= 3,
        message: 'Visual traits can contain at most 3 items.',
      },
    },
    semanticTags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

productSchema.pre('save', function markVisualDescriptionRefresh() {
  if (this.isNew) {
    this.visualDescriptionNeedsRefresh = true;
    return;
  }

  if (trackedVisualFields.some((field) => this.isModified(field))) {
    this.visualDescriptionNeedsRefresh = true;
    clearAudioDescriptionUrls(this.audioDescriptions);
  }
});

productSchema.pre('findOneAndUpdate', function markVisualDescriptionRefreshForUpdates() {
  const update = this.getUpdate() ?? {};
  const directKeys = Object.keys(update);
  const setUpdate = update.$set ?? {};
  const unsetUpdate = update.$unset ?? {};
  const touchesTrackedField = trackedVisualFields.some((field) => {
    return directKeys.includes(field) || Object.prototype.hasOwnProperty.call(setUpdate, field) || Object.prototype.hasOwnProperty.call(unsetUpdate, field);
  });

  if (!touchesTrackedField) {
    return;
  }

  update.$set = {
    ...setUpdate,
    visualDescriptionNeedsRefresh: true,
    'audioDescriptions.en.shortUrl': '',
    'audioDescriptions.en.longUrl': '',
    'audioDescriptions.ar.shortUrl': '',
    'audioDescriptions.ar.longUrl': '',
  };

  this.setUpdate(update);
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
