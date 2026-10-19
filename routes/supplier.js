const express = require("express");
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryItem = require("../models/InventoryItem");
const { auth } = require("../middleware/auth");
const { str, nonNegInt, posInt, price, validId } = require("../utils/validate");

const router = express.Router();
router.use(auth(["supplier"]));

const handleWriteError = (err, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({ error: "You already have a product with that SKU" });
  }
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  next(err);
};

/* ---------- Products (the supplier's catalog) ---------- */

router.get("/products", async (req, res, next) => {
  try {
    res.json(await Product.find({ supplier: req.user._id }).sort({ name: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const name = str(req.body.name);
    const sku = str(req.body.sku);
    const p = price(req.body.price);
    const stock = nonNegInt(req.body.stock);

    if (!name || !sku) return res.status(400).json({ error: "Name and SKU are required" });
    if (p === null) return res.status(400).json({ error: "Price must be a number (0 or more)" });
    if (stock === null) {
      return res.status(400).json({ error: "Stock must be a whole number (0 or more)" });
    }

    const product = await Product.create({ supplier: req.user._id, name, sku, price: p, stock });
    res.status(201).json(product);
  } catch (err) {
    handleWriteError(err, res, next);
  }
});

router.patch("/products/:id", validId, async (req, res, next) => {
  try {
    const update = {};
    if (req.body.name !== undefined) {
      update.name = str(req.body.name);
      if (!update.name) return res.status(400).json({ error: "Name can't be empty" });
    }
    if (req.body.price !== undefined) {
      update.price = price(req.body.price);
      if (update.price === null) return res.status(400).json({ error: "Invalid price" });
    }
    if (req.body.stock !== undefined) {
      update.stock = nonNegInt(req.body.stock);
      if (update.stock === null) return res.status(400).json({ error: "Invalid stock" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, supplier: req.user._id },
      update,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    handleWriteError(err, res, next);
  }
});

// Add units to the supplier's stock
router.post("/products/:id/restock", validId, async (req, res, next) => {
  try {
    const quantity = posInt(req.body.quantity);
    if (quantity === null) {
      return res.status(400).json({ error: "Quantity must be a whole number, 1 or more" });
    }
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, supplier: req.user._id },
      { $inc: { stock: quantity } },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:id", validId, async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, supplier: req.user._id });
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (await Order.exists({ product: product._id, status: "pending" })) {
      return res
        .status(409)
        .json({ error: "This product has pending orders. Deliver or reject them first." });
    }
    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (err) {
    next(err);
  }
});

/* ---------- Orders placed by users ---------- */

router.get("/orders", async (req, res, next) => {
  try {
    const orders = await Order.find({ supplier: req.user._id })
      .populate("product", "stock")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// Deliver or reject a pending order.
// Delivering takes units out of the supplier's stock and adds them to the user's inventory.
router.patch("/orders/:id", validId, async (req, res, next) => {
  try {
    const status = str(req.body.status);
    if (!["delivered", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'delivered' or 'rejected'" });
    }

    // Atomically claim the order so two clicks can't deliver it twice
    const claimed = await Order.findOneAndUpdate(
      { _id: req.params.id, supplier: req.user._id, status: "pending" },
      {
        status,
        note: str(req.body.note).slice(0, 200),
        ...(status === "delivered" ? { deliveredAt: new Date() } : {}),
      },
      { new: true }
    );

    if (!claimed) {
      const exists = await Order.exists({ _id: req.params.id, supplier: req.user._id });
      return res
        .status(exists ? 409 : 404)
        .json({ error: exists ? "This order is no longer pending" : "Order not found" });
    }

    if (status === "delivered") {
      // Only succeeds if enough stock is left
      const product = await Product.findOneAndUpdate(
        { _id: claimed.product, supplier: req.user._id, stock: { $gte: claimed.quantity } },
        { $inc: { stock: -claimed.quantity } }
      );

      if (!product) {
        // Undo the claim
        await Order.updateOne(
          { _id: claimed._id },
          { status: "pending", note: "", $unset: { deliveredAt: 1 } }
        );
        return res
          .status(400)
          .json({ error: "Not enough stock to fulfil this order. Restock the product first." });
      }

      await InventoryItem.findOneAndUpdate(
        { user: claimed.user, product: claimed.product },
        {
          $inc: { quantity: claimed.quantity },
          $setOnInsert: { reorderLevel: 5, reorderQuantity: 20 },
        },
        { upsert: true }
      );
    }

    res.json(claimed);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
