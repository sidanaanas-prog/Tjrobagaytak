/**
 * Fix base64 product images: upload to Cloudinary and update DB with URLs
 */
import { createHash } from "crypto";
import { Client } from "pg";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

function signCloudinary(params: Record<string, string>, apiSecret: string): string {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(str + apiSecret).digest("hex");
}

async function uploadToCloudinary(base64: string, filePath: string): Promise<string> {
  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  const contentType = base64.match(/^data:([^;]+);/)?.[1] || "image/jpeg";
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

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, title, images FROM products WHERE array_length(images, 1) > 0 AND images[1] LIKE 'data:image%'`
  );

  console.log(`Found ${rows.length} products with base64 images`);

  for (const row of rows) {
    const productId = row.id;
    const title = row.title;
    const images: string[] = row.images;
    console.log(`\nProcessing "${title}" (${productId}) — ${images.length} image(s)`);

    const newImages: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.startsWith("data:image")) {
        newImages.push(img);
        continue;
      }
      try {
        const url = await uploadToCloudinary(img, `products/${productId}/image_${i}`);
        newImages.push(url);
        console.log(`  ✅ Image ${i + 1} uploaded: ${url}`);
      } catch (e: any) {
        console.error(`  ❌ Image ${i + 1} failed: ${e.message}`);
        newImages.push(img); // keep original on failure
      }
    }

    await client.query(
      `UPDATE products SET images = $1::text[] WHERE id = $2`,
      [newImages, productId]
    );
    console.log(`  💾 Updated DB for "${title}"`);
  }

  await client.end();
  console.log("\n✅ Done!");
}

main().catch((e) => { console.error(e); process.exit(1); });
