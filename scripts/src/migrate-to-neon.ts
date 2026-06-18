/**
 * Migrate data from Replit Helium DB to Neon DB
 * Handles: users, products, stories, banners, categories, and all other tables
 */

import { Client } from "pg";

const NEON_URL = "postgresql://neondb_owner:npg_YD5eWOfhF9gS@ep-cool-dream-ab4ufrmc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Order matters for foreign key dependencies
const TABLES = [
  // Independent tables first
  "users",
  "categories",
  "banners",
  "conversations",
  "posts",
  "phone_otps",
  "driver_profiles",
  "broadcasts",
  "promotions",
  "reports",
  "flash_sales",
  "subscriptions",
  "user_roles",
  "content_videos",
  "video_ai_comments",

  // Tables with foreign keys
  "products",         // depends on users, categories
  "stories",          // depends on users
  "messages",         // depends on conversations
  "orders",           // depends on users, products
  "follows",          // depends on users
  "blocks",           // depends on users
  "wishlists",        // depends on users, products
  "post_likes",       // depends on users, posts
  "post_comments",    // depends on users, posts
  "post_views",       // depends on users, posts
  "story_likes",      // depends on users, stories
  "story_views",      // depends on users, stories
  "content_comments", // depends on users, content_videos
  "content_likes",    // depends on users, content_videos
  "content_views",    // depends on users, content_videos
  "typing",           // depends on users
  "push_tokens",      // depends on users
  "activity",         // depends on users
  "orders",           // depends on users, products
  "rides",            // depends on users
  "driver_profiles",  // depends on users
  "phone_otps",       // depends on users
];

async function getTableData(client: Client, table: string) {
  try {
    const { rows } = await client.query(`SELECT * FROM "${table}"`);
    return rows;
  } catch (e: any) {
    console.warn(`[Skip] ${table}: ${e.message}`);
    return [];
  }
}

async function insertTableData(client: Client, table: string, data: any[]) {
  if (data.length === 0) {
    console.log(`[${table}] No data to migrate`);
    return;
  }

  const columns = Object.keys(data[0]);

  // Check which columns exist in target table
  const { rows: targetColumns } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  const targetColumnNames = new Set(targetColumns.map((r) => r.column_name));
  const validColumns = columns.filter((c) => targetColumnNames.has(c));

  if (validColumns.length === 0) {
    console.warn(`[${table}] No matching columns in target table`);
    return;
  }

  const validColumnList = validColumns.map((c) => `"${c}"`).join(", ");
  const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(", ");

  let inserted = 0;
  let skipped = 0;

  for (const row of data) {
    const values = validColumns.map((col) => {
      const val = row[col];
      if (val === undefined || val === null) return null;
      if (Array.isArray(val)) return `{${val.join(",")}}`;
      if (typeof val === "object") return JSON.stringify(val);
      return val;
    });

    try {
      await client.query(
        `INSERT INTO "${table}" (${validColumnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
      inserted++;
    } catch (e: any) {
      if (e.message.includes("duplicate key")) {
        skipped++;
      } else {
        console.warn(`[${table}] Insert failed: ${e.message}`);
        skipped++;
      }
    }
  }

  console.log(`[${table}] ✅ Inserted ${inserted}, ⚠️ Skipped ${skipped}`);
}

async function main() {
  const sourceClient = new Client({ connectionString: process.env.DATABASE_URL });
  const targetClient = new Client({ connectionString: NEON_URL });

  await sourceClient.connect();
  await targetClient.connect();

  console.log("🚀 Starting migration from Replit Helium to Neon DB...\n");

  for (const table of TABLES) {
    const data = await getTableData(sourceClient, table);
    console.log(`\n[${table}] Found ${data.length} rows`);
    await insertTableData(targetClient, table, data);
  }

  await sourceClient.end();
  await targetClient.end();

  console.log("\n✅ Migration complete!");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
