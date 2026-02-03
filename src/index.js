require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5001;

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Food Tracker API running" });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});