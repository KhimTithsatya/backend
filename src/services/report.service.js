const prisma = require('../lib/prisma');

function parseDateRangeForDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const start = d;
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function parseDateRangeForMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

async function getDailyReport({ userId = null, dateStr }) {
  if (!dateStr) throw new Error('dateStr is required (YYYY-MM-DD)');
  const { start, end } = parseDateRangeForDay(dateStr);
  const where = { createdAt: { gte: start, lt: end } };
  if (userId) where.userId = Number(userId);

  const meals = await prisma.meal.findMany({ where, include: { user: { select: { id: true, name: true } } } });
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  return { date: dateStr, meals, totalCalories };
}

async function getMonthlyReport({ userId = null, monthStr }) {
  if (!monthStr) throw new Error('monthStr is required (YYYY-MM)');
  const { start, end } = parseDateRangeForMonth(monthStr);
  const where = { createdAt: { gte: start, lt: end } };
  if (userId) where.userId = Number(userId);

  const meals = await prisma.meal.findMany({ where });
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  return { month: monthStr, totalCalories, mealsCount: meals.length };
}

module.exports = {
  getDailyReport,
  getMonthlyReport,
};
