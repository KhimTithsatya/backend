/* eslint-disable no-console */
const { PrismaClient, MealType, Role } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEMO_USERS = [
  {
    name: "Demo Admin",
    email: "admin.demo@foodtracker.local",
    password: "Admin@123",
    role: Role.ADMIN
  },
  {
    name: "Demo User",
    email: "user.demo@foodtracker.local",
    password: "User@123",
    role: Role.USER
  }
];

const DEMO_FOODS = [
  { name: "Oatmeal", calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  { name: "Banana", calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "Brown Rice", calories: 123, protein: 2.7, carbs: 25.6, fat: 1 },
  { name: "Greek Yogurt", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { name: "Almonds", calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9 }
];

async function upsertDemoUsers() {
  const out = {};

  for (const u of DEMO_USERS) {
    const hashed = await bcrypt.hash(u.password, 10);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        password: hashed
      },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        password: hashed
      }
    });

    out[u.email] = user;
  }

  return out;
}

async function ensureFoods() {
  const byName = {};

  for (const food of DEMO_FOODS) {
    let found = await prisma.food.findFirst({ where: { name: food.name } });

    if (!found) {
      found = await prisma.food.create({ data: food });
    }

    byName[food.name] = found;
  }

  return byName;
}

function datePlusDays(days) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function seedMealsForDemoUser(user, foodsByName) {
  const templates = [
    {
      name: "Demo Breakfast",
      mealType: MealType.BREAKFAST,
      plannedFor: datePlusDays(0),
      items: [
        { food: "Oatmeal", quantity: 1 },
        { food: "Banana", quantity: 1 },
        { food: "Greek Yogurt", quantity: 1 }
      ]
    },
    {
      name: "Demo Lunch",
      mealType: MealType.LUNCH,
      plannedFor: datePlusDays(0),
      items: [
        { food: "Chicken Breast", quantity: 1 },
        { food: "Brown Rice", quantity: 2 }
      ]
    },
    {
      name: "Demo Snack",
      mealType: MealType.SNACK,
      plannedFor: datePlusDays(1),
      items: [{ food: "Almonds", quantity: 1 }]
    }
  ];

  await prisma.meal.deleteMany({
    where: {
      userId: user.id,
      name: { in: templates.map((t) => t.name) }
    }
  });

  for (const t of templates) {
    await prisma.meal.create({
      data: {
        name: t.name,
        userId: user.id,
        mealType: t.mealType,
        plannedFor: t.plannedFor,
        items: {
          create: t.items
            .map((item) => {
              const food = foodsByName[item.food];
              if (!food) return null;
              return {
                foodId: food.id,
                quantity: item.quantity
              };
            })
            .filter(Boolean)
        }
      }
    });
  }
}

async function main() {
  const users = await upsertDemoUsers();
  const foodsByName = await ensureFoods();
  await seedMealsForDemoUser(users["user.demo@foodtracker.local"], foodsByName);

  console.log("Seed complete.");
  console.log("Demo accounts:");
  console.log("- admin.demo@foodtracker.local / Admin@123");
  console.log("- user.demo@foodtracker.local / User@123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
