import prisma from "../../../lib/prisma";
import { auth } from "../../../middleware/auth";

async function handler(req, res) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const users = await prisma.user.findMany();
  res.json(users);
}

export default auth(handler);
