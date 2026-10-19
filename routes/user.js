const express = require("express");
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryItem = require("../models/InventoryItem");
const { auth } = require("../middleware/auth");
const { nonNegInt, posInt, validId } = require("../utils/validate");
const mongoose = require("mongoose");

const router = express.Router();
router.use(auth(["user"]));

/* ---------- Supplier catalog (what can be ordered) ---------- */

router.get("/catalog", async (req, res, next) => {
  try {
    const products = await Product.find().populate("supplier", "name").sort({ name: 1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

/* ---------- The user's own inventory ---------- */

router.get("/inventory", async (req, res, next) => {
  try {
    const [items, pending] = await Promise.all([
      InventoryItem.find({ user: req.user._id })
        .populate({
          path: "product",
          select: "name sku price stock supplier",
          populate: { path: "supplier", select: "name" },
        })
        .sort({ createdAt: -1 })
        .lean(),
      Order.aggregate([
        { $match: { user: req.user._id, status: "pending" } },
        { $group: { _id: "$product", qty: { $sum: "$quantity" } } },
      ]),
    ]);

    const pendingByProduct = new Map(pending.map((p) => [String(p._id), p.qty]));

    res.json(
      items.map((item) => ({
        ...item,
        lowStock: item.quantity <= item.reorderLevel,
        pendingQty: item.product ? pendingByProduct.get(String(item.product._id)) || 0 : 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post("/inventory", async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ error: "Pick a product from the catalog" });
    }
    const quantity = nonNegInt(req.body.quantity);
    const reorderLevel = nonNegInt(req.body.reorderLevel);
    const reorderQuantity = posInt(req.body.reorderQuantity);
    if (quantity === null) return res.status(400).json({ error: "Invalid quantity" });
    if (reorderLevel === null) return res.status(400).json({ error: "Invalid reorder level" });
    if (reorderQuantity === null) return res.status(400).json({ error: "Invalid reorder quantity" });

    if (!(await Product.exists({ _id: productId }))) {
      return res.status(404).json({ error: "Product not found" });
    }

    const item = await InventoryItem.create({
      user: req.user._id,
      product: productId,
      quantity,
      reorderLevel,
      reorderQuantity,
    });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This product is already in your inventory" });
    }
    next(err);
  }
});

router.patch("/inventory/:id", validId, async (req, res, next) => {
  try {
    const update = {};
    const fields = [
      ["quantity", nonNegInt],
      ["reorderLevel", nonNegInt],
      ["reorderQuantity", posInt],
    ];
    for (const [field, parse] of fields) {
      if (req.body[field] !== undefined) {
        const value = parse(req.body[field]);
        if (value === null) return res.status(400).json({ error: `Invalid ${field}` });
        update[field] = value;
      }
    }

    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete("/inventory/:id", validId, async (req, res, next) => {
  try {
    const item = await InventoryItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Removed from inventory" });
  } catch (err) {
    next(err);
  }
});

/* ---------- Orders ---------- */

router.get("/orders", async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("supplier", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.post("/orders", async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ error: "Invalid product" });
    }
    const quantity = posInt(req.body.quantity);
    if (quantity === null) {
      return res.status(400).json({ error: "Quantity must be a whole number, 1 or more" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product no longer exists" });

    const order = await Order.create({
      user: req.user._id,
      supplier: product.supplier,
      product: product._id,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.price,
      quantity,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.patch("/orders/:id/cancel", validId, async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: "pending" },
      { status: "cancelled" },
      { new: true }
    );
    if (!order) {
      return res.status(409).json({ error: "Only pending orders can be cancelled" });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
