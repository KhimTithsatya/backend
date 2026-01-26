const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");

router.get("/me", auth, (req, res) => {
  res.json(req.user);
});

router.get("/dashboard", auth, (req, res) => {
  res.json({ message: "User dashboard data" });
});

module.exports = router;
