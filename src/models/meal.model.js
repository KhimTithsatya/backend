const prisma = require('../lib/prisma');

async function findById(id) {
	return prisma.meal.findUnique({ where: { id: Number(id) } });
}

async function findAll(opts = {}) {
	return prisma.meal.findMany(opts);
}

async function findByUser(userId) {
	return prisma.meal.findMany({ where: { userId: Number(userId) }, orderBy: { createdAt: 'desc' } });
}

async function create(data) {
	return prisma.meal.create({ data });
}

async function update(id, data) {
	return prisma.meal.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
	return prisma.meal.delete({ where: { id: Number(id) } });
}

module.exports = {
	findById,
	findAll,
	findByUser,
	create,
	update,
	remove
};
