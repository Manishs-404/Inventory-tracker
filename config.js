require("dotenv").config();
const crypto = require("crypto");
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]); 
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString("hex");
  console.warn("JWT_SECRET is not set - using a temporary secret. Everyone is logged out on restart.");
}

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/stockflow",
  JWT_SECRET: jwtSecret,
};
