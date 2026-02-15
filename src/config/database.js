const prisma = require("../lib/prisma");

async function testConnection() {
  try {
    // lightweight test; works for most SQL adapters
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error("Database connection test failed:", err.message || err);
    throw err;
  }
}

module.exports = {
  prisma,
  testConnection
};
