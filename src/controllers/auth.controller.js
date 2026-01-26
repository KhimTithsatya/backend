const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  // fake example
  const user = {
    id: 1,
    email,
    role: email === "admin@gmail.com" ? "ADMIN" : "USER",
  };

  const token = jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({ token, user });
};
