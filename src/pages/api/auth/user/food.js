import prisma from "../../../lib/prisma";
import { auth } from "../../../middleware/auth";

async function handler(req, res) {
  const userId = req.user.id;

  if (req.method === "POST") {
    const { name, calories } = req.body;

    const food = await prisma.food.create({
      data: { name, calories, userId },
    });

    return res.json(food);
  }

  if (req.method === "GET") {
    const foods = await prisma.food.findMany({
      where: { userId },
    });
    return res.json(foods);
  }

  res.status(405).end();
}

export default auth(handler);
