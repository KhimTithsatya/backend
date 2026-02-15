/**
 * Validators for meal endpoints
 */

function validateCreateMeal(req, res, next) {
	const { name, calories } = req.body;
	if (!name || typeof name !== 'string' || !name.trim()) {
		return res.status(400).json({ message: 'Name is required' });
	}
	if (calories === undefined || Number.isNaN(Number(calories))) {
		return res.status(400).json({ message: 'Calories must be a number' });
	}
	next();
}

function validateUpdateMeal(req, res, next) {
	const { name, calories } = req.body;
	if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
		return res.status(400).json({ message: 'If provided, name must be a non-empty string' });
	}
	if (calories !== undefined && Number.isNaN(Number(calories))) {
		return res.status(400).json({ message: 'If provided, calories must be a number' });
	}
	next();
}

module.exports = {
	validateCreateMeal,
	validateUpdateMeal
};
