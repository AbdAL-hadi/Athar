import mongoose from 'mongoose';
import { isKnownCityValue, normalizeCityValue } from '../constants/palestinianCities.js';

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      set: normalizeCityValue,
      validate: {
        validator: (value) => isKnownCityValue(value),
        message: 'Warehouse city must be a supported Palestinian city.',
      },
    },
    cityLabel: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

warehouseSchema.index({ city: 1 }, { unique: true });

const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);

export default Warehouse;
