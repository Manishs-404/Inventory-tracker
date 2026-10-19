const mongoose = require("mongoose");

// One line in a user's own inventory. When quantity <= reorderLevel it counts as "low stock".
const inventoryItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, required: true, min: 0, default: 5 },
    reorderQuantity: { type: Number, required: true, min: 1, default: 20 },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
