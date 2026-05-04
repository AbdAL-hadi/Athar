import mongoose from 'mongoose';
import PatternStory from '../models/PatternStory.js';
import Product from '../models/Product.js';

const createSlug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseJsonField = (value, fallback) => {
  if (value === undefined) return fallback;
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeArrayField = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const parsed = parseJsonField(value, null);
    if (Array.isArray(parsed)) return normalizeArrayField(parsed);

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const serializePatternStory = (story) => {
  const plainStory = typeof story?.toObject === 'function' ? story.toObject() : story;

  if (!plainStory) return null;

  return {
    ...plainStory,
    id: plainStory._id?.toString?.() ?? plainStory.id ?? '',
    motifTags: normalizeArrayField(plainStory.motifTags),
  };
};

const serializeProductChip = (product) => ({
  id: product.slug || product._id?.toString?.() || '',
  productId: product._id?.toString?.() || '',
  slug: product.slug || '',
  name: product.title || product.name || 'Untitled Product',
  title: product.title || product.name || 'Untitled Product',
});

const ensureUniqueSlug = async (title, storyIdToIgnore = null) => {
  const baseSlug = createSlug(title) || `pattern-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;

  while (
    await PatternStory.exists({
      slug,
      ...(storyIdToIgnore ? { _id: { $ne: storyIdToIgnore } } : {}),
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const buildPatternStoryPayload = async (body = {}, file = null, existingStory = null) => {
  const payload = {};

  if (body.title !== undefined) payload.title = String(body.title ?? '').trim();
  if (body.description !== undefined) payload.description = String(body.description ?? '').trim();
  if (body.productCode !== undefined) payload.productCode = String(body.productCode ?? '').trim();
  if (body.motifTags !== undefined) payload.motifTags = normalizeArrayField(body.motifTags);
  if (body.existingImage !== undefined) payload.image = String(body.existingImage ?? '').trim();
  if (file?.filename) payload.image = `uploads/patterns/${file.filename}`;

  if (payload.title && (!existingStory || payload.title !== existingStory.title)) {
    payload.slug = await ensureUniqueSlug(payload.title, existingStory?._id ?? null);
  }

  return payload;
};

export const getPatternStories = async (_req, res) => {
  try {
    const stories = await PatternStory.find().sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: stories.length,
      data: stories.map(serializePatternStory),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Pattern stories could not be loaded right now.',
    });
  }
};

export const getPatternStoryByReference = async (req, res) => {
  try {
    const reference = String(req.params.reference ?? '').trim();
    const story = mongoose.isValidObjectId(reference)
      ? await PatternStory.findById(reference)
      : await PatternStory.findOne({ slug: reference.toLowerCase() });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Pattern story not found.',
      });
    }

    const linkedProducts = await Product.find({ patternStoryId: story._id }).select('_id title slug').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        ...serializePatternStory(story),
        products: linkedProducts.map(serializeProductChip),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Pattern story could not be loaded right now.',
    });
  }
};

export const createPatternStory = async (req, res) => {
  try {
    const payload = await buildPatternStoryPayload(req.body, req.file);

    if (!payload.title) {
      return res.status(400).json({ success: false, message: 'Pattern title is required.' });
    }

    if (!payload.description) {
      return res.status(400).json({ success: false, message: 'Pattern description is required.' });
    }

    const story = await PatternStory.create(payload);

    return res.status(201).json({
      success: true,
      message: 'Pattern story created successfully.',
      data: serializePatternStory(story),
    });
  } catch (error) {
    const status = error?.name === 'ValidationError' ? 400 : 500;

    return res.status(status).json({
      success: false,
      message: 'Pattern story could not be saved right now.',
    });
  }
};

export const updatePatternStory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid pattern story ID.' });
    }

    const existingStory = await PatternStory.findById(id);

    if (!existingStory) {
      return res.status(404).json({ success: false, message: 'Pattern story not found.' });
    }

    const payload = await buildPatternStoryPayload(req.body, req.file, existingStory);

    if (payload.title === '') {
      return res.status(400).json({ success: false, message: 'Pattern title is required.' });
    }

    if (payload.description === '') {
      return res.status(400).json({ success: false, message: 'Pattern description is required.' });
    }

    const story = await PatternStory.findByIdAndUpdate(existingStory._id, payload, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Pattern story updated successfully.',
      data: serializePatternStory(story),
    });
  } catch (error) {
    const status = error?.name === 'ValidationError' ? 400 : 500;

    return res.status(status).json({
      success: false,
      message: 'Pattern story could not be saved right now.',
    });
  }
};
