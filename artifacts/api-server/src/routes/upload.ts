import { Router, type IRouter, type Request, type Response } from "express";
import admin from "firebase-admin";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

/** Upload file to Firebase Storage via server (avoids CORS issues on Render) */
router.post("/upload", authenticate, async (req: Request, res: Response): Promise<void> => {
  const { base64, path, contentType = "image/jpeg" } = req.body;

  if (!base64 || !path) {
    res.status(400).json({ error: "base64 and path required" });
    return;
  }

  try {
    // Remove data URI prefix if present
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    // Firebase Storage bucket name — try just project ID
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "gaytak-45ae1";
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(path);

    await file.save(buffer, {
      metadata: { contentType },
      public: true,
    });

    // Make publicly accessible
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
    res.json({ url: publicUrl, path });
  } catch (err: any) {
    console.error("[Upload] Firebase Storage error:", err.message);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

export default router;
