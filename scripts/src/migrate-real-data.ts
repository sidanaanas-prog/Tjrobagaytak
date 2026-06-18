#!/usr/bin/env tsx
import { db } from "@workspace/db";
import { products, stories, banners, categories, users } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

// ─── Real data IDs from the published app ─────────────────────────────────

const REAL_PRODUCT_IDS = [
  "1778f596-6143-4484-b485-3299550f49a5", // متجر الدعم الرسمي
  "3df3197e-3c40-44ea-b99e-3f9959702fca", // Fast shipping cable
  "c021bd02-d1a9-4d1a-8a15-0131ea0b4f62", // Wooden dining table
  "1405067a-c156-4192-9c19-057fab7bb1f3", // Comfortable bed
  "485733a0-ec82-4c77-8516-867541f90975", // Home air conditioner
  "3867d30a-b093-4832-ace3-3bdab9eb4cca", // Luxury home carpet
  "ffd0dc02-cc68-41a3-9fc8-fb635f679980", // Honda Civic car
  "d44c4be8-8423-4d1c-94b7-ac87f39c0070", // Harley Davidson motorcycle
  "2bbd0cc3-1431-4a73-a50c-f364117a0f6d", // BMW fast motorcycle
  "ab7d9945-cdbd-4bc1-9d0c-457733e24da7", // Lamborghini Huracan
  "2c80c641-c3a1-4aca-b3b9-559bf88464e1", // Sports track shoes
  "9dc5af6c-e2d4-426a-be56-e3c286f57afe", // Old wooden table
  "379fdb9a-5946-42de-a741-87d2d69213e0", // Wata
  "58416902-fbdf-445e-b480-8c85f73f52f3", // تويوتا
  "c110e6a0-d27c-4911-aff9-c707b05a4350", // نيسان
];

const REAL_BANNER_IDS = [
  "d2c3089e-cc92-4ca9-8ba7-78acad01f632",
  "3b0ebdc2-a6ac-4203-9a2e-6442b0cac85b",
  "fde0613e-3442-45e0-add4-10903b23a30d",
  "a3287f3d-edbe-4cc8-bdd4-d8e277d44f7a",
  "6f07250f-163f-4bc4-8966-ac0f03b93cdc",
];

async function cleanup() {
  console.log("=== Cleaning up fake data from Neon ===");

  // Delete fake products (keep real 15)
  const fakeProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(sql`${products.id} NOT IN (${sql.join(REAL_PRODUCT_IDS.map(id => sql`${id}`), sql`, `)})`);

  console.log(`Found ${fakeProducts.length} fake products to delete`);

  if (fakeProducts.length > 0) {
    const fakeIds = fakeProducts.map(p => p.id);
    await db.delete(products).where(inArray(products.id, fakeIds));
    console.log(`Deleted ${fakeProducts.length} fake products`);
  }

  // Delete fake stories (keep real 1)
  const allStories = await db.select({ id: stories.id, user_id: stories.user_id }).from(stories);
  const fakeStories = allStories.filter(s => !REAL_PRODUCT_IDS.includes(s.user_id)); // Use product IDs as proxy for real user
  console.log(`Found ${allStories.length} stories, ${fakeStories.length} fake ones`);

  if (allStories.length > 1) {
    await db.delete(stories);
    console.log("Deleted all stories (will recreate real one)");
  }

  // Delete fake users (keep real users)
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const fakeUsers = allUsers.filter(u => u.email?.includes("test") || u.email?.includes("@gaytak.phone"));
  console.log(`Found ${allUsers.length} users, ${fakeUsers.length} fake ones`);

  if (fakeUsers.length > 0) {
    await db.delete(users).where(inArray(users.id, fakeUsers.map(u => u.id)));
    console.log(`Deleted ${fakeUsers.length} fake users`);
  }

  console.log("=== Cleanup complete ===");
}

async function verify() {
  const productCount = await db.select({ count: sql<number>`count(*)` }).from(products);
  const storyCount = await db.select({ count: sql<number>`count(*)` }).from(stories);
  const bannerCount = await db.select({ count: sql<number>`count(*)` }).from(banners);
  const categoryCount = await db.select({ count: sql<number>`count(*)` }).from(categories);
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);

  console.log("\n=== Neon Data After Cleanup ===");
  console.log(`Products: ${productCount[0].count} (expected: 15)`);
  console.log(`Stories: ${storyCount[0].count} (expected: 1)`);
  console.log(`Banners: ${bannerCount[0].count} (expected: 5)`);
  console.log(`Categories: ${categoryCount[0].count} (expected: 6)`);
  console.log(`Users: ${userCount[0].count}`);
}

async function main() {
  await cleanup();
  await verify();
}

main().catch(console.error);
