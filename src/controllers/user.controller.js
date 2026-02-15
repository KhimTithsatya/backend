const prisma = require("../lib/prisma");

const getMe = async (req, res) => {
  res.json(req.user);
};

const dashboard = async (req, res) => {
  res.json({ message: "User dashboard data" });
};

const getMeals = async (req, res) => {
  const userId = req.user.id;
  const meals = await prisma.meal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  res.json(meals);
};

const createMeal = async (req, res) => {
  const userId = req.user.id;
  const { name, calories } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }
  const meal = await prisma.meal.create({
    data: { name, calories: Number(calories), userId }
  });
  res.status(201).json(meal);
};

const deleteMeal = async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return res.status(404).json({ message: "Meal not found" });
  }
  await prisma.meal.delete({ where: { id } });
  res.json({ message: "Deleted" });
};

const getReportsDaily = async (req, res) => {
  const userId = req.user.id;
  const dateStr = req.query.date; // YYYY-MM-DD optional

  let start = null;
  let end = null;
  if (dateStr) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    start = d;
    end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 1);
  }

  const where = { userId };
  if (start && end) {
    where.createdAt = { gte: start, lt: end };
  }

  const meals = await prisma.meal.findMany({ where });
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  res.json({ date: dateStr || null, meals, totalCalories });
};

module.exports = {
  getMe,
  dashboard,
  getMeals,
  createMeal,
  deleteMeal,
  getReportsDaily
};
