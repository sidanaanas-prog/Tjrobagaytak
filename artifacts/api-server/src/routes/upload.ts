import { Router, type IRouter, type Request, type Response } from "express";
import { createHash } from "crypto";
import { objectStorageClient } from "../lib/objectStorage";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

// ─── Cloudinary helpers ────────────────────────────────────────────────────

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function signCloudinary(params: Record<string, string>, apiSecret: string): string {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(str + apiSecret).digest("hex");
}

async function uploadToCloudinary(buffer: Buffer, filePath: string, contentType: string): Promise<string> {
  const cloudName    = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey       = process.env.CLOUDINARY_API_KEY!;
  const apiSecret    = process.env.CLOUDINARY_API_SECRET!;
  const resourceType = contentType.startsWith("video/") ? "video" : "image";

  const parts    = filePath.replace(/\.[^.]+$/, "").split("/");
  const publicId = parts.pop()!;
  const folder   = parts.join("/");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sigParams: Record<string, string> = { timestamp };
  if (folder)   sigParams.folder    = folder;
  if (publicId) sigParams.public_id = publicId;

  const signature = signCloudinary(sigParams, apiSecret);
  const dataUri   = `data:${contentType};base64,${buffer.toString("base64")}`;

  const params = new URLSearchParams();
  params.append("file",      dataUri);
  params.append("api_key",   apiKey);
  params.append("timestamp", timestamp);
  params.append("signature", signature);
  if (folder)   params.append("folder",    folder);
  if (publicId) params.append("public_id", publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() }
  );
  if (!res.ok) throw new Error(`Cloudinary (${res.status}): ${await res.text()}`);
  return ((await res.json()) as { secure_url: string }).secure_url;
}

// ─── Replit Object Storage (fallback) ─────────────────────────────────────

function getPublicBucketAndPrefix(): { bucket: string; prefix: string } {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!paths[0]) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
  const parts = paths[0].replace(/^\//, "").split("/");
  return { bucket: parts[0], prefix: parts.slice(1).join("/") };
}

async function uploadToReplitStorage(buffer: Buffer, filePath: string, contentType: string, req: Request): Promise<string> {
  const { bucket: bucketName, prefix } = getPublicBucketAndPrefix();
  const objectName = prefix ? `${prefix}/${filePath}` : filePath;
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, { metadata: { contentType }, resumable: false });
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host  = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  return `${proto}://${host}/api/storage/public-objects/${filePath}`;
}

// ─── POST /upload  (صور صغيرة عبر السيرفر) ────────────────────────────────

router.post("/upload", authenticate, async (req: Request, res: Response): Promise<void> => {
  const { base64, path: filePath, contentType = "image/jpeg" } = req.body;
  if (!base64 || !filePath) {
    res.status(400).json({ error: "base64 and path are required" });
    return;
  }
  try {
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    let url: string;
    if (isCloudinaryConfigured()) {
      url = await uploadToCloudinary(buffer, filePath, contentType);
      console.log(`[Upload] ✅ Cloudinary image: ${filePath}`);
    } else {
      url = await uploadToReplitStorage(buffer, filePath, contentType, req);
      console.log(`[Upload] ✅ Replit Storage: ${filePath}`);
    }
    res.json({ url, path: filePath });
  } catch (err: any) {
    console.error("[Upload] ❌", err.message);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

// ─── GET /upload/signature  (فيديوهات كبيرة — رفع مباشر من Client) ────────
// الـ client يأخذ التوقيع ويرفع مباشرةً لـ Cloudinary بدون المرور بالسيرفر

router.get("/upload/signature", authenticate, (req: Request, res: Response): void => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: "Cloudinary not configured" });
    return;
  }

  const { path: filePath = "", resourceType = "video" } = req.query as Record<string, string>;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const parts    = filePath.replace(/\.[^.]+$/, "").split("/");
  const publicId = parts.pop()!;
  const folder   = parts.join("/");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sigParams: Record<string, string> = { timestamp };
  if (folder)   sigParams.folder    = folder;
  if (publicId) sigParams.public_id = publicId;

  const signature = signCloudinary(sigParams, apiSecret);

  res.json({
    signature,
    timestamp,
    apiKey:      process.env.CLOUDINARY_API_KEY!,
    cloudName:   process.env.CLOUDINARY_CLOUD_NAME!,
    folder:      folder || undefined,
    publicId:    publicId || undefined,
    resourceType,
  });
});

export default router;
