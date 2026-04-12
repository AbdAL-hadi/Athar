import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';
import { products } from '../src/data/products.js';

const createSlug = (value) => {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const toProductSchema = (product) => {
  return {
    title: product.name,
    slug: createSlug(product.id || product.name),
    description: product.description,
    price: Number(product.price),
    images: Array.isArray(product.images) ? product.images : [],
    category: product.category,
    material: product.material,
    stock: Number(product.stock ?? 0),
    featured: Boolean(product.featured),
  };
};

const run = async () => {
  await connectDB();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const localProduct of products.map(toProductSchema)) {
    const existing = await Product.findOne({
      $or: [{ slug: localProduct.slug }, { title: localProduct.title }],
    });

    if (!existing) {
      await Product.create(localProduct);
      inserted += 1;
      continue;
    }

    const changed =
      existing.title !== localProduct.title ||
      existing.slug !== localProduct.slug ||
      existing.description !== localProduct.description ||
      existing.price !== localProduct.price ||
      existing.category !== localProduct.category ||
      existing.material !== localProduct.material ||
      existing.stock !== localProduct.stock ||
      existing.featured !== localProduct.featured ||
      JSON.stringify(existing.images) !== JSON.stringify(localProduct.images);

    if (!changed) {
      skipped += 1;
      continue;
    }

    Object.assign(existing, localProduct);
    await existing.save();
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        found: products.length,
        inserted,
        updated,
        skipped,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error('Product seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
