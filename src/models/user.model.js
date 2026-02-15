const prisma = require('../lib/prisma');

async function findById(id) {
	return prisma.user.findUnique({ where: { id: Number(id) } });
}

async function findByEmail(email) {
	return prisma.user.findUnique({ where: { email } });
}

async function findAll() {
	return prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
}

async function create(data) {
	return prisma.user.create({ data });
}

async function update(id, data) {
	return prisma.user.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
	return prisma.user.delete({ where: { id: Number(id) } });
}

async function count() {
	return prisma.user.count();
}

module.exports = {
	findById,
	findByEmail,
	findAll,
	create,
	update,
	remove,
	count
};
