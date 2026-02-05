const prisma = require("../lib/prisma");

/**
 * Get all foods
 */
async function getAllFoods() {
  return prisma.food.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create new food
 */
async function createFood(data) {
  return prisma.food.create({
    data,
  });
}

/**
 * Update food
 */
async function updateFood(id, data) {
  return prisma.food.update({
    where: { id: Number(id) },
    data,
  });
}

/**
 * Delete food
 */
async function deleteFood(id) {
  return prisma.food.delete({
    where: { id: Number(id) },
  });
}

module.exports = {
  getAllFoods,
  createFood,
  updateFood,
  deleteFood,
};
