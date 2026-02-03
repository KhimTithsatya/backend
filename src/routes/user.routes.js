const router = require("express").Router();
const auth = require("../middleware/auth.middleware");

const prisma = require("../lib/prisma");

router.get("/me", auth, (req, res) => {
  res.json(req.user);
});

router.get("/dashboard", auth, (req, res) => {
  res.json({ message: "User dashboard data" });
});

// Meals for current user
router.get("/meals", auth, async (req, res) => {
  const userId = req.user.id;
  const meals = await prisma.meal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  res.json(meals);
});

router.post("/meals", auth, async (req, res) => {
  const userId = req.user.id;
  const { name, calories } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }
  const meal = await prisma.meal.create({
    data: { name, calories: Number(calories), userId }
  });
  res.status(201).json(meal);
});

router.delete("/meals/:id", auth, async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return res.status(404).json({ message: "Meal not found" });
  }
  await prisma.meal.delete({ where: { id } });
  res.json({ message: "Deleted" });
});

// Simple daily report for current user
router.get("/reports/daily", auth, async (req, res) => {
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
});

module.exports = router;
