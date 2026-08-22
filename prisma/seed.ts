import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const CITIES = ["Lisbon", "Tokyo", "Cape Town", "Mexico City", "Reykjavik", "Hanoi"];
const ACTIVITY_TITLES = [
  "Walking food tour",
  "Museum visit",
  "Sunset hike",
  "Cooking class",
  "Beach day",
  "City bike tour",
];

async function main() {
  console.log("Seeding admin test data...");

  // 1. Admin user — log in as this one to test /admin.
  const admin = await prisma.user.upsert({
    where: { email: "admin@globetrotter.test" },
    update: {},
    create: {
      name: "Ava Administrator",
      email: "admin@globetrotter.test",
      role: "admin",
      status: "active",
      lastActiveAt: new Date(),
      createdAt: daysAgo(120),
    },
  });

  // 2. A spread of regular users across roles/statuses/join dates,
  //    so the stats cards and table have something real to show.
  const userSeeds = [
    { name: "Liam Chen", status: "active", createdAgo: 2, lastActiveAgo: 0 },
    { name: "Sofia Reyes", status: "active", createdAgo: 5, lastActiveAgo: 1 },
    { name: "Noah Patel", status: "active", createdAgo: 9, lastActiveAgo: 3 },
    { name: "Emma Dubois", status: "active", createdAgo: 15, lastActiveAgo: 6 },
    { name: "Yusuf Karim", status: "suspended", createdAgo: 20, lastActiveAgo: 25 },
    { name: "Mia Johansson", status: "active", createdAgo: 25, lastActiveAgo: 12 },
    { name: "Diego Alvarez", status: "invited", createdAgo: 1, lastActiveAgo: null },
    { name: "Priya Nair", status: "active", createdAgo: 40, lastActiveAgo: 2 },
    { name: "Ethan Brooks", status: "active", createdAgo: 60, lastActiveAgo: 45 },
    { name: "Hana Suzuki", status: "active", createdAgo: 3, lastActiveAgo: 0 },
  ];

  const users = [];
  for (const seed of userSeeds) {
    const email = `${seed.name.toLowerCase().replace(/\s+/g, ".")}@globetrotter.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: seed.name,
        email,
        role: "user",
        status: seed.status,
        createdAt: daysAgo(seed.createdAgo),
        lastActiveAt: seed.lastActiveAgo === null ? null : daysAgo(seed.lastActiveAgo),
      },
    });
    users.push(user);
  }

  // 3. Trips + activities spread over the last 30 days, so the time-series
  //    chart (grouped by day) has non-empty buckets to aggregate.
  let tripCount = 0;
  let activityCount = 0;

  for (const user of users) {
    if (user.status !== "active") continue;

    const numTrips = Math.floor(Math.random() * 3) + 1; // 1-3 trips per active user
    for (let t = 0; t < numTrips; t++) {
      const tripCreatedAgo = Math.floor(Math.random() * 28);
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];

      const trip = await prisma.trip.create({
        data: {
          title: `${city} trip`,
          city,
          userId: user.id,
          createdAt: daysAgo(tripCreatedAgo),
        },
      });
      tripCount++;

      const numActivities = Math.floor(Math.random() * 4) + 1; // 1-4 activities per trip
      for (let a = 0; a < numActivities; a++) {
        const activityCreatedAgo = Math.max(0, tripCreatedAgo - Math.floor(Math.random() * 3));
        await prisma.activity.create({
          data: {
            title: ACTIVITY_TITLES[Math.floor(Math.random() * ACTIVITY_TITLES.length)],
            tripId: trip.id,
            createdAt: daysAgo(activityCreatedAgo),
          },
        });
        activityCount++;
      }
    }
  }

  console.log(`Seeded 1 admin, ${users.length} users, ${tripCount} trips, ${activityCount} activities.`);
  console.log(`Log in as: admin@globetrotter.test`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
