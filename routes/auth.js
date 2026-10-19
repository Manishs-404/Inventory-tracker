const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../config");
const { auth } = require("../middleware/auth");
const { str } = require("../utils/validate");

const router = express.Router();

const sign = (user) => jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res, next) => {
  try {
    const name = str(req.body.name);
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const role = str(req.body.role);

    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email" });
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!["supplier", "user"].includes(role)) {
      return res.status(400).json({ error: "Choose a role: supplier or user" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role });
    res.status(201).json({ token: sign(user), user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";

    const user = await User.findOne({ email }).select("+password");
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) return res.status(401).json({ error: "Incorrect email or password" });

    res.json({ token: sign(user), user });
  } catch (err) {
    next(err);
  }
});

router.get("/me", auth(), (req, res) => res.json(req.user));

module.exports = router;
