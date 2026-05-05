import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMatchReason, getMatchQuality } from '../services/productMatch/productMatchService.js';

test('match quality thresholds treat scores below 20 percent as no match', () => {
  assert.equal(getMatchQuality(0.19), 'none');
  assert.equal(getMatchQuality(0.2), 'weak');
  assert.equal(getMatchQuality(0.44), 'weak');
  assert.equal(getMatchQuality(0.45), 'medium');
  assert.equal(getMatchQuality(0.69), 'medium');
  assert.equal(getMatchQuality(0.7), 'strong');
});

test('strong matches use customer-friendly wording and include matched fields', () => {
  const result = buildMatchReason({
    analysis: {
      productType: 'bag',
      category: 'Bags',
      colors: ['black'],
      materials: ['leather'],
      keywords: ['structured'],
      style: ['elegant'],
      occasion: [],
      motifs: [],
      shape: 'structured silhouette',
    },
    product: {
      title: 'Structured Carryall',
      category: 'Bags',
      material: 'Black leather',
      color: 'black',
      dominantColors: ['black'],
      styleTags: ['structured'],
      semanticTags: ['elegant'],
      materialTags: ['leather'],
    },
    similarityScore: 0.82,
  });

  assert.equal(
    result.text,
    'The uploaded image looks very similar to this product based on category, colors, materials, and style.',
  );
  assert.deepEqual(result.matchedFields, ['category', 'colors', 'materials', 'keywords']);
});

test('medium matches stay cautious and mention only the fields that matched', () => {
  const result = buildMatchReason({
    analysis: {
      productType: 'wallet',
      category: 'Wallets',
      colors: ['tan'],
      materials: ['canvas'],
      keywords: ['floral'],
      style: [],
      occasion: [],
      motifs: [],
      shape: '',
    },
    product: {
      title: 'Desert Card Holder',
      category: 'Wallets',
      material: 'Leather',
      color: 'tan',
      dominantColors: ['tan'],
      styleTags: ['minimal'],
      semanticTags: [],
      materialTags: ['leather'],
    },
    similarityScore: 0.54,
  });

  assert.equal(
    result.text,
    "This product shares some visual details with your uploaded image and is one of the closest matches in Athar's collection, especially in category and colors.",
  );
  assert.deepEqual(result.matchedFields, ['category', 'colors']);
});

test('weak matches avoid overpromising when no specific fields line up', () => {
  const result = buildMatchReason({
    analysis: {
      productType: 'ring',
      category: 'Rings',
      colors: ['blue'],
      materials: ['beads'],
      keywords: ['chunky'],
      style: [],
      occasion: [],
      motifs: [],
      shape: '',
    },
    product: {
      title: 'Olive Branch Watch',
      category: 'Watches',
      material: 'Metal',
      color: 'gold',
      dominantColors: ['gold'],
      styleTags: ['refined'],
      semanticTags: ['watch'],
      materialTags: ['metal'],
    },
    similarityScore: 0.22,
  });

  assert.equal(
    result.text,
    "This is the closest available product in Athar's current collection, although it may not be an exact match.",
  );
  assert.deepEqual(result.matchedFields, []);
});
