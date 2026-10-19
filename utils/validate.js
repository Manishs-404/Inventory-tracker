const mongoose = require("mongoose");

// Returns a trimmed string, or "" if the value isn't a string
// (this also blocks NoSQL-injection objects like { "$gt": "" }).
const str = (v) => (typeof v === "string" ? v.trim() : "");

const asNumber = (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);

const nonNegInt = (v) => {
  const n = asNumber(v);
  return Number.isInteger(n) && n >= 0 && n <= 10_000_000 ? n : null;
};

const posInt = (v) => {
  const n = nonNegInt(v);
  return n !== null && n >= 1 ? n : null;
};

const price = (v) => {
  const n = asNumber(v);
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1_000_000_000
    ? Math.round(n * 100) / 100
    : null;
};

const validId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  next();
};

module.exports = { str, nonNegInt, posInt, price, validId };
