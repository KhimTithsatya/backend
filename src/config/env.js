const dotenv = require("dotenv");
dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing required environment variables:", missing.join(", "));
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  SALT_ROUNDS: Number(process.env.SALT_ROUNDS) || 10,
  isProduction: process.env.NODE_ENV === "production"
};

module.exports = config;
