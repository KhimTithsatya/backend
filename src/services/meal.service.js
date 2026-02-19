const prisma = require('../lib/prisma');

async function getAllMeals() {
  return prisma.meal.findMany({ orderBy: { createdAt: 'desc' } });
}

async function getMealById(id) {
  return prisma.meal.findUnique({ where: { id: Number(id) } });
}

async function getMealsByUser(userId) {
  return prisma.meal.findMany({ where: { userId: Number(userId) }, orderBy: { createdAt: 'desc' } });
}

async function createMeal(data) {
  const payload = { ...data };
  if (payload.calories !== undefined) payload.calories = Number(payload.calories);
  return prisma.meal.create({ data: payload });
}

async function updateMeal(id, data) {
  const payload = { ...data };
  if (payload.calories !== undefined) payload.calories = Number(payload.calories);
  return prisma.meal.update({ where: { id: Number(id) }, data: payload });
}

async function deleteMeal(id) {
  return prisma.meal.delete({ where: { id: Number(id) } });
}

async function deleteMealsByUser(userId) {
  return prisma.meal.deleteMany({ where: { userId: Number(userId) } });
}

module.exports = {
  getAllMeals,
  getMealById,
  getMealsByUser,
  createMeal,
  updateMeal,
  deleteMeal,
  deleteMealsByUser,
};
