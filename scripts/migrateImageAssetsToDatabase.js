import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';
import PatternStory from '../models/PatternStory.js';
import {
  attachImageAssetsToOwner,
  createImageAssetFromFilePath,
  extractAssetIdFromValue,
} from '../services/assets/imageAssetService.js';

const normalizePathValue = (value = '') => String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.?\//, '');

const buildCandidatePaths = (imageValue = '') => {
  const normalizedValue = normalizePathValue(imageValue);
  const fileName = path.basename(normalizedValue);

  return [
    path.join(process.cwd(), normalizedValue),
    path.join(process.cwd(), 'src', 'assets', normalizedValue),
    path.join(process.cwd(), 'src', 'assets', 'products', fileName),
    path.join(process.cwd(), 'uploads', normalizedValue.replace(/^uploads\//, '')),
    path.join(process.cwd(), 'generated', normalizedValue.replace(/^generated\//, '')),
  ];
};

const resolveExistingFilePath = (imageValue = '') => {
  const normalizedValue = normalizePathValue(imageValue);

  if (!normalizedValue) {
    return '';
  }

  return buildCandidatePaths(normalizedValue).find((candidate) => fs.existsSync(candidate)) || '';
};

const shouldSkipValue = (value = '') => {
  const normalizedValue = normalizePathValue(value);

  return (
    !normalizedValue ||
    Boolean(extractAssetIdFromValue(normalizedValue)) ||
    /^(?:https?:)?\/\//i.test(normalizedValue) ||
    normalizedValue.startsWith('data:')
  );
};

const migrateProducts = async () => {
  const products = await Product.find();
  let migratedCount = 0;

  for (const product of products) {
    const nextImages = [];
    let changed = false;

    for (const image of product.images || []) {
      if (image?.assetId) {
        nextImages.push(image);
        continue;
      }

      if (shouldSkipValue(image)) {
        continue;
      }

      const filePath = resolveExistingFilePath(image);

      if (!filePath) {
        console.warn(`[migrate-images] Product ${product._id} image missing on disk: ${image}`);
        continue;
      }

      const reference = await createImageAssetFromFilePath(filePath, {
        fileName: path.basename(filePath),
        kind: 'product',
        ownerModel: 'Product',
        ownerId: product._id,
      });
      nextImages.push(reference);
      changed = true;
    }

    if (!changed) {
      continue;
    }

    product.images = nextImages;
    await product.save();
    await attachImageAssetsToOwner(nextImages, {
      ownerModel: 'Product',
      ownerId: product._id,
    });
    migratedCount += 1;
  }

  return migratedCount;
};

const migratePatternStories = async () => {
  const stories = await PatternStory.find();
  let migratedCount = 0;

  for (const story of stories) {
    if (story.image?.assetId || shouldSkipValue(story.image)) {
      continue;
    }

    const filePath = resolveExistingFilePath(story.image);

    if (!filePath) {
      console.warn(`[migrate-images] Pattern story ${story._id} image missing on disk: ${story.image}`);
      continue;
    }

    const reference = await createImageAssetFromFilePath(filePath, {
      fileName: path.basename(filePath),
      kind: 'pattern-story',
      ownerModel: 'PatternStory',
      ownerId: story._id,
    });

    story.image = reference;
    await story.save();
    await attachImageAssetsToOwner([reference], {
      ownerModel: 'PatternStory',
      ownerId: story._id,
    });
    migratedCount += 1;
  }

  return migratedCount;
};

const run = async () => {
  await connectDB();

  const migratedProducts = await migrateProducts();
  const migratedPatternStories = await migratePatternStories();

  console.log(
    `[migrate-images] Done. Migrated ${migratedProducts} products and ${migratedPatternStories} pattern stories.`,
  );
};

run()
  .catch((error) => {
    console.error('[migrate-images] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
