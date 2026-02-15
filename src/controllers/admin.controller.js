const prisma = require("../lib/prisma");

const dashboard = async (req, res) => {
	const [users, meals, foods] = await Promise.all([
		prisma.user.count(),
		prisma.meal.count(),
		prisma.food.count().catch(() => 0)
	]);
	res.json({ users, meals, foods });
};

// Users
const getUsers = async (req, res) => {
	const users = await prisma.user.findMany({
		select: { id: true, name: true, email: true, role: true, createdAt: true },
		orderBy: { createdAt: "desc" }
	});
	res.json(users);
};

const updateUserRole = async (req, res) => {
	const id = Number(req.params.id);
	const { role } = req.body;

	if (!role || !["ADMIN", "USER"].includes(String(role).toUpperCase())) {
		return res.status(400).json({ message: "Role must be ADMIN or USER" });
	}

	const updated = await prisma.user.update({
		where: { id },
		data: { role: String(role).toUpperCase() },
		select: { id: true, name: true, email: true, role: true }
	});
	res.json(updated);
};

const deleteUser = async (req, res) => {
	const id = Number(req.params.id);
	await prisma.meal.deleteMany({ where: { userId: id } });
	await prisma.user.delete({ where: { id } });
	res.json({ message: "Deleted" });
};

// Foods
const getFoods = async (req, res) => {
	const foods = await prisma.food.findMany({ orderBy: { createdAt: "desc" } });
	res.json(foods);
};

const createFood = async (req, res) => {
	const { name, calories } = req.body;
	if (!name || calories === undefined) {
		return res.status(400).json({ message: "Missing fields" });
	}
	const food = await prisma.food.create({ data: { name, calories: Number(calories) } });
	res.status(201).json(food);
};

const updateFood = async (req, res) => {
	const id = Number(req.params.id);
	const { name, calories } = req.body;
	const food = await prisma.food.update({
		where: { id },
		data: { name, calories: Number(calories) }
	});
	res.json(food);
};

const deleteFood = async (req, res) => {
	const id = Number(req.params.id);
	await prisma.food.delete({ where: { id } });
	res.json({ message: "Deleted" });
};

// Meals
const getMeals = async (req, res) => {
	const meals = await prisma.meal.findMany({
		include: { user: { select: { id: true, name: true, email: true } } },
		orderBy: { createdAt: "desc" }
	});
	res.json(meals);
};

const deleteMeal = async (req, res) => {
	const id = Number(req.params.id);
	await prisma.meal.delete({ where: { id } });
	res.json({ message: "Deleted" });
};

// Reports
const getReportsDaily = async (req, res) => {
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
};

const getReportsMonthly = async (req, res) => {
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

	const meals = await prisma.meal.findMany({ where: { createdAt: { gte: start, lt: end } } });
	const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
	res.json({ month: monthStr, totalCalories, mealsCount: meals.length });
};

module.exports = {
  dashboard,
  getUsers,
  updateUserRole,
  deleteUser,
  getFoods,
  createFood,
  updateFood,
  deleteFood,
  getMeals,
  deleteMeal,
  getReportsDaily,
  getReportsMonthly
};

