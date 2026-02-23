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
    include: {
      items: {
        include: { food: { select: { calories: true } } }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const mealsWithCalories = meals.map((meal) => {
    const calories = meal.items.reduce(
      (sum, item) => sum + (item.food?.calories || 0) * (item.quantity || 0),
      0
    );
    return { ...meal, calories };
  });
  res.json(mealsWithCalories);
});

router.post("/meals", auth, async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Meal name is required" });
  }
  const meal = await prisma.meal.create({
    data: { name: String(name).trim(), userId }
  });
  res.status(201).json({ ...meal, calories: 0, items: [] });
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

// Foods (shared reference table)
router.get("/foods", auth, async (_req, res) => {
  const foods = await prisma.food.findMany({ orderBy: { createdAt: "desc" } });
  res.json(foods);
});

router.post("/foods", auth, async (req, res) => {
  const { name, calories } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const food = await prisma.food.create({
    data: { name, calories: Number(calories) }
  });
  res.status(201).json(food);
});

router.put("/foods/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, calories } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const existing = await prisma.food.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Food not found" });
  }

  const food = await prisma.food.update({
    where: { id },
    data: { name, calories: Number(calories) }
  });
  res.json(food);
});

router.delete("/foods/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.food.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Food not found" });
  }

  await prisma.food.delete({ where: { id } });
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

  const meals = await prisma.meal.findMany({
    where,
    include: {
      items: {
        include: { food: { select: { calories: true } } }
      }
    }
  });

  const mealsWithCalories = meals.map((meal) => {
    const calories = meal.items.reduce(
      (sum, item) => sum + (item.food?.calories || 0) * (item.quantity || 0),
      0
    );
    return { ...meal, calories };
  });

  const totalCalories = mealsWithCalories.reduce(
    (sum, meal) => sum + (meal.calories || 0),
    0
  );
  res.json({ date: dateStr || null, meals: mealsWithCalories, totalCalories });
});

module.exports = router;
