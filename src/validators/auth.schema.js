/**
 * Simple auth validators (no external deps).
 */

function validateRegister(req, res, next) {
	const { name, email, password } = req.body;
	if (!name || typeof name !== 'string' || !name.trim()) {
		return res.status(400).json({ message: 'Name is required' });
	}
	if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		return res.status(400).json({ message: 'Valid email is required' });
	}
	if (!password || typeof password !== 'string' || password.length < 6) {
		return res.status(400).json({ message: 'Password must be at least 6 characters' });
	}
	next();
}

function validateLogin(req, res, next) {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json({ message: 'Email and password are required' });
	}
	next();
}

module.exports = {
	validateRegister,
	validateLogin
};
