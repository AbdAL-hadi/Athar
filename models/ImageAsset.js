import mongoose from 'mongoose';

const imageAssetSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    kind: {
      type: String,
      default: 'general',
      trim: true,
    },
    ownerModel: {
      type: String,
      default: '',
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
);

const ImageAsset = mongoose.models.ImageAsset || mongoose.model('ImageAsset', imageAssetSchema);

export default ImageAsset;
