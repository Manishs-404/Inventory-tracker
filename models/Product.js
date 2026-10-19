const mongoose = require("mongoose");

// A product in a supplier's catalog. `stock` is what the supplier has on hand.
const productSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

// A supplier can't reuse the same SKU twice
productSchema.index({ supplier: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model("Product", productSchema);
