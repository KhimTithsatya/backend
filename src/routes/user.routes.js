const router = require("express").Router();
const auth = require("../middleware/auth.middleware");

const prisma = require("../lib/prisma");
const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"];
const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024; // ~5MB chars

function buildMealInclude() {
  return {
    items: {
      include: {
        food: {
          select: {
            id: true,
            name: true,
            calories: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    }
  };
}

function withCalories(meal) {
  const calories = (meal.items || []).reduce(
    (sum, item) => sum + (item.food?.calories || 0) * (item.quantity || 0),
    0
  );
  return { ...meal, calories };
}

async function getOwnedMealOrNull(userId, id) {
  const mealId = Number(id);
  if (!Number.isInteger(mealId) || mealId <= 0) return null;

  return prisma.meal.findFirst({
    where: { id: mealId, userId },
    include: buildMealInclude()
  });
}

function parsePlannedFor(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(`${String(value)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "INVALID_DATE";
  return parsed;
}

function sanitizeImageDataUrl(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return `Invalid ${fieldName}`;
  if (!value.startsWith("data:image/")) return `${fieldName} must be an image`;
  if (!value.includes(";base64,")) return `${fieldName} must be base64 encoded`;
  if (value.length > MAX_DATA_URL_LENGTH) return `${fieldName} is too large`;
  return value;
}

function getMealPayload(body, { requireName }) {
  const payload = {};
  const name = body?.name;
  const mealType = String(body?.mealType || "OTHER").toUpperCase();
  const plannedFor = parsePlannedFor(body?.plannedFor);

  if (requireName || name !== undefined) {
    if (!name || !String(name).trim()) {
      return { error: "Meal name is required" };
    }
    payload.name = String(name).trim();
  }

  if (!MEAL_TYPES.includes(mealType)) {
    return { error: "mealType must be one of: BREAKFAST, LUNCH, DINNER, SNACK, OTHER" };
  }
  payload.mealType = mealType;

  if (plannedFor === "INVALID_DATE") {
    return { error: "plannedFor must be a valid date in YYYY-MM-DD format" };
  }
  payload.plannedFor = plannedFor;

  return { payload };
}

router.get("/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, profileImage: true }
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

router.get("/profile", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, profileImage: true, createdAt: true, updatedAt: true }
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

router.put("/profile", auth, async (req, res) => {
  const userId = req.user.id;
  const { name, email, profileImage } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Name is required" });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ message: "Email is required" });
  }

  const parsedImage = sanitizeImageDataUrl(profileImage, "profileImage");
  if (typeof parsedImage === "string" && !parsedImage.startsWith("data:image/")) {
    return res.status(400).json({ message: parsedImage });
  }

  const emailText = String(email).trim().toLowerCase();
  const emailOwner = await prisma.user.findUnique({ where: { email: emailText } });
  if (emailOwner && emailOwner.id !== userId) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: String(name).trim(),
      email: emailText,
      ...(parsedImage !== undefined ? { profileImage: parsedImage } : {})
    },
    select: { id: true, name: true, email: true, role: true, profileImage: true, createdAt: true, updatedAt: true }
  });

  res.json(updated);
});

router.get("/dashboard", auth, async (req, res) => {
  const userId = req.user.id;

  const meals = await prisma.meal.findMany({
    where: { userId },
    include: {
      items: {
        select: {
          quantity: true,
          food: { select: { calories: true } }
        }
      }
    }
  });

  const foodsTrackedRows = await prisma.mealItem.findMany({
    where: { meal: { userId } },
    select: { foodId: true },
    distinct: ["foodId"]
  });

  const totalMeals = meals.length;
  const totalCalories = meals.reduce((sum, meal) => {
    const mealCalories = meal.items.reduce(
      (itemSum, item) =>
        itemSum + (item.food?.calories || 0) * (item.quantity || 0),
      0
    );
    return sum + mealCalories;
  }, 0);

  const avgCalories = totalMeals > 0 ? Math.round(totalCalories / totalMeals) : 0;
  const totalFoods = foodsTrackedRows.length;

  res.json({ totalMeals, avgCalories, totalFoods, totalCalories });
});

// Meals for current user
router.get("/meals", auth, async (req, res) => {
  const userId = req.user.id;
  const fromDate = parsePlannedFor(req.query.from);
  const toDate = parsePlannedFor(req.query.to);
  const mealTypeQuery = req.query.mealType
    ? String(req.query.mealType).toUpperCase()
    : null;

  if (fromDate === "INVALID_DATE" || toDate === "INVALID_DATE") {
    return res.status(400).json({ message: "from/to must be valid dates in YYYY-MM-DD format" });
  }

  if (mealTypeQuery && !MEAL_TYPES.includes(mealTypeQuery)) {
    return res.status(400).json({ message: "mealType must be one of: BREAKFAST, LUNCH, DINNER, SNACK, OTHER" });
  }

  const where = { userId };
  if (mealTypeQuery) {
    where.mealType = mealTypeQuery;
  }
  if (fromDate || toDate) {
    where.plannedFor = {};
    if (fromDate) where.plannedFor.gte = fromDate;
    if (toDate) {
      const end = new Date(toDate);
      end.setUTCDate(end.getUTCDate() + 1);
      where.plannedFor.lt = end;
    }
  }

  const meals = await prisma.meal.findMany({
    where,
    include: buildMealInclude(),
    orderBy: [{ plannedFor: "desc" }, { createdAt: "desc" }]
  });
  const mealsWithCalories = meals.map(withCalories);
  res.json(mealsWithCalories);
});

router.post("/meals", auth, async (req, res) => {
  const userId = req.user.id;
  const { payload, error } = getMealPayload(req.body, { requireName: true });

  if (error) {
    return res.status(400).json({ message: error });
  }

  const meal = await prisma.meal.create({
    data: { ...payload, userId }
  });
  res.status(201).json({ ...meal, calories: 0, items: [] });
});

router.put("/meals/:id", auth, async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const { payload, error } = getMealPayload(req.body, { requireName: true });
  if (error) {
    return res.status(400).json({ message: error });
  }

  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return res.status(404).json({ message: "Meal not found" });
  }

  const updated = await prisma.meal.update({
    where: { id },
    data: payload,
    include: buildMealInclude()
  });

  res.json(withCalories(updated));
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

router.post("/meals/:id/items", auth, async (req, res) => {
  const userId = req.user.id;
  const mealId = Number(req.params.id);
  const foodId = Number(req.body?.foodId);
  const quantity = Number(req.body?.quantity || 1);

  if (!Number.isInteger(foodId) || foodId <= 0) {
    return res.status(400).json({ message: "foodId is required" });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "quantity must be a positive integer" });
  }

  const meal = await getOwnedMealOrNull(userId, mealId);
  if (!meal) {
    return res.status(404).json({ message: "Meal not found" });
  }

  const food = await prisma.food.findUnique({ where: { id: foodId } });
  if (!food) {
    return res.status(404).json({ message: "Food not found" });
  }

  const existing = await prisma.mealItem.findUnique({
    where: { mealId_foodId: { mealId, foodId } }
  });

  if (existing) {
    await prisma.mealItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity }
    });
  } else {
    await prisma.mealItem.create({
      data: { mealId, foodId, quantity }
    });
  }

  const updatedMeal = await getOwnedMealOrNull(userId, mealId);
  return res.status(201).json(withCalories(updatedMeal));
});

router.put("/meals/:id/items/:itemId", auth, async (req, res) => {
  const userId = req.user.id;
  const mealId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "quantity must be a positive integer" });
  }

  const meal = await getOwnedMealOrNull(userId, mealId);
  if (!meal) {
    return res.status(404).json({ message: "Meal not found" });
  }

  const item = await prisma.mealItem.findUnique({ where: { id: itemId } });
  if (!item || item.mealId !== mealId) {
    return res.status(404).json({ message: "Meal item not found" });
  }

  await prisma.mealItem.update({
    where: { id: itemId },
    data: { quantity }
  });

  const updatedMeal = await getOwnedMealOrNull(userId, mealId);
  return res.json(withCalories(updatedMeal));
});

router.delete("/meals/:id/items/:itemId", auth, async (req, res) => {
  const userId = req.user.id;
  const mealId = Number(req.params.id);
  const itemId = Number(req.params.itemId);

  const meal = await getOwnedMealOrNull(userId, mealId);
  if (!meal) {
    return res.status(404).json({ message: "Meal not found" });
  }

  const item = await prisma.mealItem.findUnique({ where: { id: itemId } });
  if (!item || item.mealId !== mealId) {
    return res.status(404).json({ message: "Meal item not found" });
  }

  await prisma.mealItem.delete({ where: { id: itemId } });
  const updatedMeal = await getOwnedMealOrNull(userId, mealId);
  return res.json(withCalories(updatedMeal));
});

// Foods (shared reference table)
router.get("/foods", auth, async (_req, res) => {
  const foods = await prisma.food.findMany({ orderBy: { createdAt: "desc" } });
  res.json(foods);
});

router.post("/foods", auth, async (req, res) => {
  const { name, calories, image } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const parsedImage = sanitizeImageDataUrl(image, "image");
  if (typeof parsedImage === "string" && !parsedImage.startsWith("data:image/")) {
    return res.status(400).json({ message: parsedImage });
  }

  const food = await prisma.food.create({
    data: { name, calories: Number(calories), image: parsedImage || null }
  });
  res.status(201).json(food);
});

router.put("/foods/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, calories, image } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const parsedImage = sanitizeImageDataUrl(image, "image");
  if (typeof parsedImage === "string" && !parsedImage.startsWith("data:image/")) {
    return res.status(400).json({ message: parsedImage });
  }

  const existing = await prisma.food.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Food not found" });
  }

  const food = await prisma.food.update({
    where: { id },
    data: {
      name,
      calories: Number(calories),
      ...(parsedImage !== undefined ? { image: parsedImage } : {})
    }
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
    include: buildMealInclude()
  });

  const mealsWithCalories = meals.map(withCalories);

  const totalCalories = mealsWithCalories.reduce(
    (sum, meal) => sum + (meal.calories || 0),
    0
  );
  res.json({ date: dateStr || null, meals: mealsWithCalories, totalCalories });
});

module.exports = router;
