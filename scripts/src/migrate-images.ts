/**
 * Migrate images from Replit Object Storage to Cloudinary
 * Updates all image URLs in the database to point to Cloudinary
 */

import { Client } from "pg";
import { createHash } from "crypto";

const NEON_URL = "postgresql://neondb_owner:npg_YD5eWOfhF9gS@ep-cool-dream-ab4ufrmc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const REPLIT_URL = process.env.DATABASE_URL;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

function signCloudinary(params: Record<string, string>, apiSecret: string): string {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(str + apiSecret).digest("hex");
}

async function uploadToCloudinary(buffer: Buffer, filePath: string, contentType: string): Promise<string> {
  const resourceType = contentType.startsWith("video/") ? "video" : "image";

  const parts = filePath.replace(/\.[^.]+$/, "").split("/");
  const publicId = parts.pop()!;
  const folder = parts.join("/");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sigParams: Record<string, string> = { timestamp };
  if (folder) sigParams.folder = folder;
  if (publicId) sigParams.public_id = publicId;

  const signature = signCloudinary(sigParams, API_SECRET);
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;

  const params = new URLSearchParams();
  params.append("file", dataUri);
  params.append("api_key", API_KEY);
  params.append("timestamp", timestamp);
  params.append("signature", signature);
  if (folder) params.append("folder", folder);
  if (publicId) params.append("public_id", publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() }
  );
  if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { secure_url: string }).secure_url;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { timeout: 30000 } as any);
    if (!res.ok) {
      console.warn(`  ⚠️ Failed to download ${url}: ${res.status}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return { buffer, contentType };
  } catch (e: any) {
    console.warn(`  ⚠️ Error downloading ${url}: ${e.message}`);
    return null;
  }
}

async function migrateProducts(client: Client) {
  console.log("\n📷 Migrating product images...");
  const { rows } = await client.query(`SELECT id, title, images FROM products WHERE array_length(images, 1) > 0`);

  for (const row of rows) {
    const newImages: string[] = [];
    let changed = false;

    for (let i = 0; i < row.images.length; i++) {
      const img = row.images[i];
      if (!img || !img.includes("replit.dev")) {
        newImages.push(img);
        continue;
      }

      console.log(`  Processing ${row.title} - image ${i + 1}/${row.images.length}`);
      const downloaded = await downloadImage(img);
      if (!downloaded) {
        newImages.push(img);
        continue;
      }

      try {
        const url = await uploadToCloudinary(
          downloaded.buffer,
          `products/${row.id}/image_${i}`,
          downloaded.contentType
        );
        newImages.push(url);
        changed = true;
        console.log(`    ✅ Uploaded to Cloudinary`);
      } catch (e: any) {
        console.warn(`    ❌ Upload failed: ${e.message}`);
        newImages.push(img);
      }
    }

    if (changed) {
      await client.query(`UPDATE products SET images = $1::text[] WHERE id = $2`, [newImages, row.id]);
      console.log(`  💾 Updated ${row.title}`);
    }
  }
}

async function migrateUsers(client: Client) {
  console.log("\n👤 Migrating user avatars...");
  const { rows } = await client.query(`SELECT id, name, avatar FROM users WHERE avatar IS NOT NULL AND avatar LIKE '%replit.dev%'`);

  for (const row of rows) {
    console.log(`  Processing ${row.name}`);
    const downloaded = await downloadImage(row.avatar);
    if (!downloaded) continue;

    try {
      const url = await uploadToCloudinary(
        downloaded.buffer,
        `avatars/${row.id}`,
        downloaded.contentType
      );
      await client.query(`UPDATE users SET avatar = $1 WHERE id = $2`, [url, row.id]);
      console.log(`  ✅ Updated ${row.name}`);
    } catch (e: any) {
      console.warn(`  ❌ Upload failed: ${e.message}`);
    }
  }
}

async function migrateStories(client: Client) {
  console.log("\n📸 Migrating story media...");
  const { rows } = await client.query(`SELECT id, user_id, media_url FROM stories WHERE media_url IS NOT NULL AND media_url LIKE '%replit.dev%'`);

  for (const row of rows) {
    console.log(`  Processing story ${row.id.slice(0, 8)}`);
    const downloaded = await downloadImage(row.media_url);
    if (!downloaded) continue;

    try {
      const url = await uploadToCloudinary(
        downloaded.buffer,
        `stories/${row.user_id}/${row.id}`,
        downloaded.contentType
      );
      await client.query(`UPDATE stories SET media_url = $1 WHERE id = $2`, [url, row.id]);
      console.log(`  ✅ Updated story`);
    } catch (e: any) {
      console.warn(`  ❌ Upload failed: ${e.message}`);
    }
  }
}

async function migrateBanners(client: Client) {
  console.log("\n🖼️ Migrating banner images...");
  const { rows } = await client.query(`SELECT id, title, image_url FROM banners WHERE image_url IS NOT NULL AND image_url LIKE '%replit.dev%'`);

  for (const row of rows) {
    console.log(`  Processing ${row.title}`);
    const downloaded = await downloadImage(row.image_url);
    if (!downloaded) continue;

    try {
      const url = await uploadToCloudinary(
        downloaded.buffer,
        `banners/${row.id}`,
        downloaded.contentType
      );
      await client.query(`UPDATE banners SET image_url = $1 WHERE id = $2`, [url, row.id]);
      console.log(`  ✅ Updated ${row.title}`);
    } catch (e: any) {
      console.warn(`  ❌ Upload failed: ${e.message}`);
    }
  }
}

async function main() {
  const neonClient = new Client({ connectionString: NEON_URL });
  await neonClient.connect();

  console.log("🚀 Starting image migration to Cloudinary...\n");

  await migrateProducts(neonClient);
  await migrateUsers(neonClient);
  await migrateStories(neonClient);
  await migrateBanners(neonClient);

  await neonClient.end();
  console.log("\n✅ Image migration complete!");
}

// Run the migration
main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
