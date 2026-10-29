const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const collections = {
  users: 'users',
  expenses: 'expenses',
  income: 'incomes',
  categories: 'categories',
  budgets: 'budgets',
  recurring: 'recurringexpenses',
  notifications: 'notifications',
  split_groups: 'splitgroups',
  split_expenses: 'splitexpenses',
  split_settlements: 'splitsettlements',
  tiffin_groups: 'tiffingroups',
  tiffin_entries: 'tiffinentries',
};

function toPlain(value) {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, toPlain(child)]));
  }
  return value;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI in backend/.env before exporting data.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const database = mongoose.connection.db;
  const existingCollections = new Set((await database.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name));
  const data = { formatVersion: 1, exportedAt: new Date().toISOString(), collections: {} };

  for (const [kind, collectionName] of Object.entries(collections)) {
    if (!existingCollections.has(collectionName)) {
      data.collections[kind] = [];
      continue;
    }
    data.collections[kind] = (await database.collection(collectionName).find({}).toArray()).map(toPlain);
  }

  const outputDirectory = path.resolve(__dirname, '..', 'migration-data');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputFile = path.join(outputDirectory, 'mongo-export.json');
  fs.writeFileSync(outputFile, JSON.stringify(data), { encoding: 'utf8', flag: 'w' });
  const counts = Object.entries(data.collections)
    .map(([kind, records]) => `${kind}=${records.length}`)
    .join(', ');
  console.log(`MongoDB export saved locally (${counts}). Keep migration-data/mongo-export.json private.`);
}

main()
  .catch((error) => {
    console.error('MongoDB export failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
