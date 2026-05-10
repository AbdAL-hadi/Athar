import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Warehouse from '../models/Warehouse.js';

const initialWarehouses = [
  { name: 'Nablus Warehouse', city: 'nablus', cityLabel: 'Nablus' },
  { name: 'Hebron Warehouse', city: 'hebron', cityLabel: 'Hebron' },
  { name: 'Gaza Warehouse', city: 'gaza', cityLabel: 'Gaza' },
];

const seedWarehouses = async () => {
  await connectDB();

  for (const warehouse of initialWarehouses) {
    const existingWarehouse = await Warehouse.findOne({ city: warehouse.city });
    const savedWarehouse = await Warehouse.findOneAndUpdate(
      { city: warehouse.city },
      { $set: { ...warehouse, isActive: true } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    const action = existingWarehouse ? 'Updated' : 'Created';
    console.log(`${action}: ${savedWarehouse.name} (${savedWarehouse.city})`);
  }
};

seedWarehouses()
  .then(async () => {
    await mongoose.connection.close();
    console.log('Warehouse seeding complete.');
  })
  .catch(async (error) => {
    console.error('Warehouse seeding failed:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  });
