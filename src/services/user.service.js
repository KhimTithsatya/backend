const bcrypt = require('bcryptjs');
const userModel = require('../models/user.model');

const SALT_ROUNDS = 10;

function sanitize(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

async function getById(id) {
  const user = await userModel.findById(id);
  return sanitize(user);
}

async function getByEmail(email) {
  const user = await userModel.findByEmail(email);
  return sanitize(user);
}

async function getAll() {
  const users = await userModel.findAll();
  return users.map(sanitize);
}

async function create(data) {
  if (!data) throw new Error('Missing user data');
  const payload = { ...data };
  if (payload.password) {
    payload.password = await bcrypt.hash(String(payload.password), SALT_ROUNDS);
  }
  const created = await userModel.create(payload);
  return sanitize(created);
}

async function update(id, data) {
  if (!data) throw new Error('Missing update data');
  const payload = { ...data };
  if (payload.password) {
    payload.password = await bcrypt.hash(String(payload.password), SALT_ROUNDS);
  }
  const updated = await userModel.update(id, payload);
  return sanitize(updated);
}

async function remove(id) {
  return userModel.remove(id);
}

module.exports = {
  getById,
  getByEmail,
  getAll,
  create,
  update,
  remove
};
