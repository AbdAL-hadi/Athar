import test from 'node:test';
import assert from 'node:assert/strict';

import Product from '../models/Product.js';
import {
  buildVisualDescriptionResponse,
  selectStoredDescriptionText,
  shouldRefreshVisualDescription,
} from '../services/visualDescriber/visualDescriptionHelpers.js';

test('Product schema exposes backward-compatible visual description defaults', () => {
  const product = new Product({
    title: 'Peacock Eye Wallet',
    slug: 'peacock-eye-wallet',
    description: 'A refined leather wallet carrying the Peacock Eye motif.',
    price: 120,
    images: ['products/peacock-eye-wallet.png'],
    category: 'Wallets',
    material: 'Engraved black leather',
  });

  assert.equal(product.visualDescriptionStatus, 'not_generated');
  assert.equal(product.visualDescriptionNeedsRefresh, true);
  assert.equal(product.visualDescriptions.en.short, '');
  assert.deepEqual(product.styleTags, []);
  assert.equal(product.audioDescriptions.en.shortUrl, '');
});

test('refresh logic only triggers when visual input fields change', () => {
  const currentProduct = {
    title: 'Desert Carryall',
    description: 'A warmer neutral carryall.',
    category: 'Bags',
    material: 'Soft structured leather',
    images: ['products/desert-carryall.png'],
    stock: 5,
  };

  assert.equal(
    shouldRefreshVisualDescription(currentProduct, { stock: 6 }),
    false,
  );
  assert.equal(
    shouldRefreshVisualDescription(currentProduct, { title: 'Desert Carryall Updated' }),
    true,
  );
  assert.equal(
    shouldRefreshVisualDescription(currentProduct, { images: ['products/new-image.png'] }),
    true,
  );
});

test('stored description text falls back to english when requested language is missing', () => {
  const product = {
    visualDescriptions: {
      en: {
        short: 'An elegant wallet with engraved detail.',
        long: 'A longer English accessibility description.',
      },
      ar: {
        short: '',
        long: '',
      },
    },
  };

  const selected = selectStoredDescriptionText(product, 'ar', 'short');
  assert.equal(selected.language, 'en');
  assert.equal(selected.text, 'An elegant wallet with engraved detail.');
});

test('visual description response separates facts from AI inferences', () => {
  const product = {
    title: 'Athar Gaza Rose Handbag',
    slug: 'athar-gaza-rose-handbag',
    category: 'Bags',
    material: 'Heritage-embossed leather',
    description: 'A structured handbag shaped around soft blush tones.',
    visualDescriptionStatus: 'generated',
    visualDescriptionNeedsRefresh: false,
    visualDescriptions: {
      en: {
        short: 'A structured blush-toned handbag with refined detail.',
        long: 'A longer accessibility description.',
      },
      ar: {
        short: '',
        long: '',
      },
    },
    styleTags: ['elegant', 'heritage-inspired'],
    occasionTags: ['gift'],
    dominantColors: ['pink', 'beige'],
    visualTraits: ['structured silhouette', 'floral detail', 'soft blush tone'],
    semanticTags: ['bags', 'heritage-inspired'],
    audioDescriptions: {
      en: { shortUrl: '/uploads/audio-descriptions/example.wav', longUrl: '' },
      ar: { shortUrl: '', longUrl: '' },
    },
  };

  const response = buildVisualDescriptionResponse(product, 'products/athar-gaza-rose-handbag.png');

  assert.equal(response.facts.title, 'Athar Gaza Rose Handbag');
  assert.equal(response.inferences.descriptions.en.short, 'A structured blush-toned handbag with refined detail.');
  assert.deepEqual(response.inferences.visualTraits, ['structured silhouette', 'floral detail', 'soft blush tone']);
  assert.equal(response.audioDescriptions.en.shortUrl, '/uploads/audio-descriptions/example.wav');
});
