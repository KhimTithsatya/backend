const router = require("express").Router();
const bcrypt = require("bcryptjs");

const auth = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/admin.middleware");
const prisma = require("../lib/prisma");
const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024; // ~5MB chars
const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"];

function parseDescription(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return "INVALID_DESCRIPTION";
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 1000) return "DESCRIPTION_TOO_LONG";
  return normalized;
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

router.use(auth, isAdmin);

// --------------------
// Admin Dashboard
// --------------------
router.get("/dashboard", async (req, res) => {
  const [users, meals, foods] = await Promise.all([
    prisma.user.count(),
    prisma.meal.count(),
    prisma.food.count().catch(() => 0)
  ]);

  res.json({ users, meals, foods });
});

// --------------------
// Users
// --------------------
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, profileImage: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, profileImage } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const emailText = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: emailText } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const normalizedRole = String(role || "USER").toUpperCase();
    if (!["USER", "ADMIN"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Role must be ADMIN or USER" });
    }

    const parsedImage = sanitizeImageDataUrl(profileImage, "profileImage");
    if (typeof parsedImage === "string" && !parsedImage.startsWith("data:image/")) {
      return res.status(400).json({ message: parsedImage });
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const created = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: emailText,
        password: hashed,
        role: normalizedRole,
        authProviders: "credentials",
        profileImage: parsedImage || null
      },
      select: { id: true, name: true, email: true, role: true, profileImage: true, createdAt: true }
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImage: true,
        authProviders: true,
        heightCm: true,
        weightKg: true,
        age: true,
        sex: true,
        activityLevel: true,
        goalType: true,
        dailyCalorieTarget: true,
        proteinGoal: true,
        carbsGoal: true,
        fatGoal: true,
        timezone: true,
        dateFormat: true,
        language: true,
        notifyMealReminders: true,
        notifyWeeklySummary: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [mealsCount, foodsTrackedRows] = await Promise.all([
      prisma.meal.count({ where: { userId: id } }),
      prisma.mealItem.findMany({
        where: { meal: { userId: id } },
        select: { foodId: true },
        distinct: ["foodId"]
      })
    ]);

    return res.json({
      ...user,
      authProviders: String(user.authProviders || "credentials")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      mealsCount,
      foodsTrackedCount: foodsTrackedRows.length
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch user details" });
  }
});

router.put("/users/:id/role", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!role || !["ADMIN", "USER"].includes(String(role).toUpperCase())) {
      return res.status(400).json({ message: "Role must be ADMIN or USER" });
    }

    const normalizedRole = String(role).toUpperCase();
    if (req.user.id === id && normalizedRole !== "ADMIN") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: normalizedRole },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(500).json({ message: "Failed to update role" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const {
      name,
      email,
      role,
      profileImage,
      heightCm,
      weightKg,
      age,
      sex,
      activityLevel,
      goalType,
      dailyCalorieTarget,
      proteinGoal,
      carbsGoal,
      fatGoal,
      notifyMealReminders,
      notifyWeeklySummary
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedRole = String(role || "USER").toUpperCase();
    if (!["USER", "ADMIN"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Role must be ADMIN or USER" });
    }
    if (req.user.id === id && normalizedRole !== "ADMIN") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const parsedImage = sanitizeImageDataUrl(profileImage, "profileImage");
    if (typeof parsedImage === "string" && !parsedImage.startsWith("data:image/")) {
      return res.status(400).json({ message: parsedImage });
    }

    const emailText = String(email).trim().toLowerCase();
    const emailOwner = await prisma.user.findUnique({ where: { email: emailText } });
    if (emailOwner && emailOwner.id !== id) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: String(name).trim(),
        email: emailText,
        role: normalizedRole,
        ...(parsedImage !== undefined ? { profileImage: parsedImage } : {}),
        ...(heightCm !== undefined ? { heightCm: heightCm === "" || heightCm === null ? null : Number(heightCm) } : {}),
        ...(weightKg !== undefined ? { weightKg: weightKg === "" || weightKg === null ? null : Number(weightKg) } : {}),
        ...(age !== undefined ? { age: age === "" || age === null ? null : Number(age) } : {}),
        ...(sex !== undefined ? { sex: sex || null } : {}),
        ...(activityLevel !== undefined ? { activityLevel: activityLevel || null } : {}),
        ...(goalType !== undefined ? { goalType: goalType || null } : {}),
        ...(dailyCalorieTarget !== undefined ? { dailyCalorieTarget: dailyCalorieTarget === "" || dailyCalorieTarget === null ? null : Number(dailyCalorieTarget) } : {}),
        ...(proteinGoal !== undefined ? { proteinGoal: proteinGoal === "" || proteinGoal === null ? null : Number(proteinGoal) } : {}),
        ...(carbsGoal !== undefined ? { carbsGoal: carbsGoal === "" || carbsGoal === null ? null : Number(carbsGoal) } : {}),
        ...(fatGoal !== undefined ? { fatGoal: fatGoal === "" || fatGoal === null ? null : Number(fatGoal) } : {}),
        ...(notifyMealReminders !== undefined ? { notifyMealReminders: Boolean(notifyMealReminders) } : {}),
        ...(notifyWeeklySummary !== undefined ? { notifyWeeklySummary: Boolean(notifyWeeklySummary) } : {})
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImage: true,
        authProviders: true,
        heightCm: true,
        weightKg: true,
        age: true,
        sex: true,
        activityLevel: true,
        goalType: true,
        dailyCalorieTarget: true,
        proteinGoal: true,
        carbsGoal: true,
        fatGoal: true,
        notifyMealReminders: true,
        notifyWeeklySummary: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.json({
      ...updated,
      authProviders: String(updated.authProviders || "credentials")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    });
  } catch (err) {
    console.error(err);
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(500).json({ message: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (req.user.id === id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    // Delete meals first to satisfy FK constraints
    await prisma.meal.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// --------------------
// Foods (reference table)
// --------------------
router.get("/foods", async (req, res) => {
  const foods = await prisma.food.findMany({ orderBy: { createdAt: "desc" } });
  res.json(foods);
});

router.post("/foods", async (req, res) => {
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

router.put("/foods/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, calories, image } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const parsedImage = sanitizeImageDataUrl(image, "image");
  if (typeof parsedImage === "string" && !parsedImage.startsWith("data:image/")) {
    return res.status(400).json({ message: parsedImage });
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

router.delete("/foods/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.food.delete({ where: { id } });
  res.json({ message: "Deleted" });
});

// --------------------
// Meals
// --------------------
router.get("/meals", async (req, res) => {
  const meals = await prisma.meal.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(meals);
});

router.post("/meals", async (req, res) => {
  try {
    const { userId, name, mealType, plannedFor, description } = req.body || {};
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return res.status(400).json({ message: "Valid userId is required" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Meal name is required" });
    }

    const normalizedMealType = String(mealType || "OTHER").toUpperCase();
    if (!MEAL_TYPES.includes(normalizedMealType)) {
      return res.status(400).json({ message: "Invalid mealType" });
    }
    const parsedDescription = parseDescription(description);
    if (parsedDescription === "INVALID_DESCRIPTION") {
      return res.status(400).json({ message: "description must be a string" });
    }
    if (parsedDescription === "DESCRIPTION_TOO_LONG") {
      return res.status(400).json({ message: "description must be at most 1000 characters" });
    }

    let parsedPlannedFor = null;
    if (plannedFor !== undefined && plannedFor !== null && String(plannedFor).trim() !== "") {
      parsedPlannedFor = new Date(`${String(plannedFor)}T00:00:00.000Z`);
      if (Number.isNaN(parsedPlannedFor.getTime())) {
        return res.status(400).json({ message: "plannedFor must be YYYY-MM-DD" });
      }
    }

    const user = await prisma.user.findUnique({ where: { id: parsedUserId }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const meal = await prisma.meal.create({
      data: {
        userId: parsedUserId,
        name: String(name).trim(),
        mealType: normalizedMealType,
        plannedFor: parsedPlannedFor,
        ...(parsedDescription !== undefined ? { description: parsedDescription } : {})
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    return res.status(201).json(meal);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create meal" });
  }
});

router.put("/meals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { userId, name, mealType, plannedFor, description } = req.body || {};
    const parsedUserId = Number(userId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid meal id" });
    }
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return res.status(400).json({ message: "Valid userId is required" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Meal name is required" });
    }

    const normalizedMealType = String(mealType || "OTHER").toUpperCase();
    if (!MEAL_TYPES.includes(normalizedMealType)) {
      return res.status(400).json({ message: "Invalid mealType" });
    }
    const parsedDescription = parseDescription(description);
    if (parsedDescription === "INVALID_DESCRIPTION") {
      return res.status(400).json({ message: "description must be a string" });
    }
    if (parsedDescription === "DESCRIPTION_TOO_LONG") {
      return res.status(400).json({ message: "description must be at most 1000 characters" });
    }

    let parsedPlannedFor = null;
    if (plannedFor !== undefined && plannedFor !== null && String(plannedFor).trim() !== "") {
      parsedPlannedFor = new Date(`${String(plannedFor)}T00:00:00.000Z`);
      if (Number.isNaN(parsedPlannedFor.getTime())) {
        return res.status(400).json({ message: "plannedFor must be YYYY-MM-DD" });
      }
    }

    const user = await prisma.user.findUnique({ where: { id: parsedUserId }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        userId: parsedUserId,
        name: String(name).trim(),
        mealType: normalizedMealType,
        plannedFor: parsedPlannedFor,
        ...(parsedDescription !== undefined ? { description: parsedDescription } : {})
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    return res.json(meal);
  } catch (err) {
    console.error(err);
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "Meal not found" });
    }
    return res.status(500).json({ message: "Failed to update meal" });
  }
});

router.delete("/meals/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.meal.delete({ where: { id } });
  res.json({ message: "Deleted" });
});

// --------------------
// Reports
// --------------------
router.get("/reports/daily", async (req, res) => {
  const dateStr = req.query.date; // YYYY-MM-DD optional
  if (!dateStr) {
    return res.status(400).json({ message: "Missing date query param" });
  }
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const start = d;
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 1);

  const meals = await prisma.meal.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { user: { select: { id: true, name: true } } }
  });
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  res.json({ date: dateStr, meals, totalCalories });
});

router.get("/reports/monthly", async (req, res) => {
  const monthStr = req.query.month; // YYYY-MM
  if (!monthStr) {
    return res.status(400).json({ message: "Missing month query param" });
  }
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month) {
    return res.status(400).json({ message: "Invalid month format" });
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const meals = await prisma.meal.findMany({
    where: { createdAt: { gte: start, lt: end } }
  });
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  res.json({ month: monthStr, totalCalories, mealsCount: meals.length });
});

module.exports = router;
