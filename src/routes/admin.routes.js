const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/admin.middleware");

router.use(auth, isAdmin);

router.get("/", (req, res) => {
  res.json({ message: "Admin dashboard data" });
});

module.exports = router;
