const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = require("../config");

// Usage: router.use(auth(["supplier"])) or auth() for any logged-in user.
function auth(roles = []) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: "Not authenticated" });

      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return res.status(401).json({ error: "Account no longer exists" });

      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ error: "This page is not available for your role" });
      }

      req.user = user;
      next();
    } catch (err) {
      if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Invalid or expired session" });
      }
      next(err);
    }
  };
}

module.exports = { auth };
