// Creates demo accounts and sample data:  npm run seed
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MONGO_URI } = require("./config");
const User = require("./models/User");
const Product = require("./models/Product");
const InventoryItem = require("./models/InventoryItem");

(async () => {
  await mongoose.connect(MONGO_URI);

  if (await User.findOne({ email: "supplier@demo.com" })) {
    console.log("Demo data already exists - nothing to do.");
    return mongoose.disconnect();
  }

  const password = await bcrypt.hash("demo1234", 10);
  const supplier = await User.create({
    name: "Acme Supplies",
    email: "supplier@demo.com",
    password,
    role: "supplier",
  });
  const user = await User.create({
    name: "Corner Store",
    email: "user@demo.com",
    password,
    role: "user",
  });

  const [rice, oil, sugar, tea] = await Product.create([
    { supplier: supplier._id, name: "Basmati Rice 5kg", sku: "RICE-5KG", price: 620, stock: 200 },
    { supplier: supplier._id, name: "Sunflower Oil 1L", sku: "OIL-1L", price: 165, stock: 150 },
    { supplier: supplier._id, name: "Sugar 1kg", sku: "SUG-1KG", price: 48, stock: 300 },
    { supplier: supplier._id, name: "Tea Powder 250g", sku: "TEA-250", price: 110, stock: 80 },
    { supplier: supplier._id, name: "Notebook A5", sku: "NB-A5", price: 35, stock: 500 },
  ]);

  await InventoryItem.create([
    { user: user._id, product: rice._id, quantity: 4, reorderLevel: 10, reorderQuantity: 30 }, // low
    { user: user._id, product: oil._id, quantity: 25, reorderLevel: 10, reorderQuantity: 20 }, // ok
    { user: user._id, product: sugar._id, quantity: 0, reorderLevel: 15, reorderQuantity: 50 }, // out
    { user: user._id, product: tea._id, quantity: 12, reorderLevel: 10, reorderQuantity: 20 }, // ok
  ]);

  console.log("Seeded.\n  Supplier: supplier@demo.com / demo1234\n  User:     user@demo.com / demo1234");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
