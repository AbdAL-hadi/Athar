import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { getInventoryState } from '../services/admin/inventoryState.js';

const APPLY_FLAG = '--apply';
const shouldApply = process.argv.includes(APPLY_FLAG);

const requiredWarehouses = [
  { name: 'Nablus Warehouse', city: 'nablus', cityLabel: 'Nablus' },
  { name: 'Hebron Warehouse', city: 'hebron', cityLabel: 'Hebron' },
  { name: 'Gaza Warehouse', city: 'gaza', cityLabel: 'Gaza' },
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const buildStockDistribution = () => {
  const total = randomInt(112, 178);
  const gaza = randomInt(24, 58);
  const hebron = randomInt(32, 66);
  const nablus = Math.max(20, total - gaza - hebron);

  if (gaza + hebron + nablus <= 100) {
    return buildStockDistribution();
  }

  return { gaza, hebron, nablus };
};

const ensureWarehouses = async () => {
  const warehouses = [];

  for (const warehouse of requiredWarehouses) {
    const savedWarehouse = await Warehouse.findOneAndUpdate(
      { city: warehouse.city },
      { $set: { ...warehouse, isActive: true } },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    warehouses.push(savedWarehouse);
  }

  return warehouses;
};

const run = async () => {
  await connectDB();

  const products = await Product.find().sort({ title: 1 });
  const warehouses = await ensureWarehouses();

  if (products.length === 0) {
    console.log('No products found.');
    return;
  }

  const warehousesByCity = new Map(warehouses.map((warehouse) => [warehouse.city, warehouse]));
  const summary = [];

  for (const product of products) {
    const distribution = buildStockDistribution();
    const totalStock = Object.values(distribution).reduce((sum, quantity) => sum + quantity, 0);
    const inventoryState = getInventoryState(totalStock, product.lowStockThreshold);

    summary.push({
      title: product.title,
      Gaza: distribution.gaza,
      Hebron: distribution.hebron,
      Nablus: distribution.nablus,
      Total: totalStock,
    });

    if (!shouldApply) continue;

    for (const [city, quantity] of Object.entries(distribution)) {
      const warehouse = warehousesByCity.get(city);

      await WarehouseStock.findOneAndUpdate(
        { product: product._id, warehouse: warehouse._id },
        {
          $set: {
            quantity,
            lowStockThreshold: 10,
          },
          $setOnInsert: {
            reservedQuantity: 0,
          },
        },
        { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
    }

    product.stock = totalStock;
    product.lowStockThreshold = inventoryState.lowStockThreshold;
    product.lowStockFlag = inventoryState.lowStockFlag;
    product.inventoryStatus = inventoryState.inventoryStatus;
    product.lastRestockDate = new Date();
    await product.save();
  }

  console.table(summary);
  console.log(shouldApply ? 'Warehouse inventory updated.' : `Dry run only. Re-run with ${APPLY_FLAG} to update the database.`);
};

run()
  .catch((error) => {
    console.error('Inventory randomization failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
