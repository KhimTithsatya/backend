const prisma = require('../lib/prisma');

async function findAll() {
	return prisma.food.findMany({ orderBy: { createdAt: 'desc' } });
}

async function findById(id) {
	return prisma.food.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
	return prisma.food.create({ data });
}

async function update(id, data) {
	return prisma.food.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
	return prisma.food.delete({ where: { id: Number(id) } });
}

module.exports = {
	findAll,
	findById,
	create,
	update,
	remove
};
