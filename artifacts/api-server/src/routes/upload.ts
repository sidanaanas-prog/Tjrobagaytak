import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { objectStorageClient } from "../lib/objectStorage";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

function getPublicBucketAndPrefix(): { bucket: string; prefix: string } {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!paths[0]) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
  // format: /bucket-name/prefix  e.g. /replit-objstore-xxx/public
  const parts = paths[0].replace(/^\//, "").split("/");
  const bucket = parts[0];
  const prefix = parts.slice(1).join("/");
  return { bucket, prefix };
}

router.post("/upload", authenticate, async (req: Request, res: Response): Promise<void> => {
  const { base64, path: filePath, contentType = "image/jpeg" } = req.body;

  if (!base64 || !filePath) {
    res.status(400).json({ error: "base64 and path are required" });
    return;
  }

  try {
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    // Upload to Replit Object Storage (public bucket)
    const { bucket: bucketName, prefix } = getPublicBucketAndPrefix();
    const objectName = prefix ? `${prefix}/${filePath}` : filePath;

    const bucket = objectStorageClient.bucket(bucketName);
    const file   = bucket.file(objectName);
    await file.save(buffer, { metadata: { contentType }, resumable: false });

    // Build public URL — served via our API /api/storage/public-objects/{path}
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host  = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const url   = `${proto}://${host}/api/storage/public-objects/${filePath}`;

    console.log(`[Upload] ✅ ${filePath} → bucket=${bucketName}/${objectName}`);
    res.json({ url, path: filePath });
  } catch (err: any) {
    console.error("[Upload] ❌ Failed:", err.message);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

export default router;
