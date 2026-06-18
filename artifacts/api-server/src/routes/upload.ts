import { Router, type IRouter, type Request, type Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { objectStorageClient } from "../lib/objectStorage";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

// ─── detect environment ────────────────────────────────────────────────────

const IS_REPLIT = !!process.env.REPLIT_DOMAINS || !!process.env.REPL_ID || !!process.env.REPLIT_OWNER_ID;

// ─── Cloudinary (fallback for non-Replit hosts like Render) ─────────────

function initCloudinary() {
  const name = process.env.CLOUDINARY_CLOUD_NAME || "";
  const key  = process.env.CLOUDINARY_API_KEY  || "";
  const secret = process.env.CLOUDINARY_API_SECRET || "";
  if (!name || !key || !secret) {
    console.warn("[Upload] Cloudinary env vars missing — uploads will fail on non-Replit hosts");
  }
  cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret });
}

if (!IS_REPLIT) {
  initCloudinary();
}

async function uploadToCloudinary(base64: string, folder: string): Promise<string> {
  const result = await cloudinary.uploader.upload(base64, {
    folder: `gaytak/${folder}`,
    resource_type: "image",
  });
  return result.secure_url;
}

// ─── Replit Object Storage ─────────────────────────────────────────────────

function getPublicBucketAndPrefix(): { bucket: string; prefix: string } {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!paths[0]) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
  const parts = paths[0].replace(/^\//, "").split("/");
  return { bucket: parts[0], prefix: parts.slice(1).join("/") };
}

function getHost(req: Request): string {
  if (process.env.REPLIT_DOMAINS) {
    return process.env.REPLIT_DOMAINS.split(",")[0].trim();
  }
  const forwarded = req.headers["x-forwarded-host"] as string;
  if (forwarded) return forwarded;
  const host = req.headers.host || "localhost";
  return host === "localhost:80" ? "localhost" : host;
}

async function uploadToReplitStorage(buffer: Buffer, filePath: string, contentType: string, req: Request): Promise<string> {
  const { bucket: bucketName, prefix } = getPublicBucketAndPrefix();
  const objectName = prefix ? `${prefix}/${filePath}` : filePath;
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, { metadata: { contentType }, resumable: false });
  const host = getHost(req);
  return `https://${host}/api/storage/public-objects/${filePath}`;
}

// ─── POST /upload ─────────────────────────────────────────────────────────

router.post("/upload", authenticate, async (req: Request, res: Response): Promise<void> => {
  const { base64, path: filePath, contentType = "image/jpeg" } = req.body;
  if (!base64 || !filePath) {
    res.status(400).json({ error: "base64 and path are required" });
    return;
  }
  try {
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");

    // Always use Cloudinary for cross-platform compatibility
    const url = await uploadToCloudinary(base64, filePath.split("/")[0] || "general");
    console.log(`[Upload] ✅ Cloudinary: ${filePath}`);
    res.json({ url, path: filePath });
  } catch (err: any) {
    console.error("[Upload] ❌", err.message);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

export default router;
