import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// ── Digital Asset Links (Play Console domain verification) ──────────────────
app.get("/.well-known/assetlinks.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json([
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: "com.gaytak.gaytak",
        sha256_cert_fingerprints: [
          "F4:31:10:AB:93:36:1A:2D:CB:FD:24:D1:27:04:A5:3E:8E:E3:EF:0C:EF:15:C5:EC:F1:FB:9B:44:0F:0C:35:B5",
        ],
      },
    },
  ]);
});

// Full-stack Vite / Static Files serving
if (process.env.NODE_ENV !== "production") {
  const vitePkgName = "vite";
  const { createServer: createViteServer } = await import(vitePkgName);
  const path = await import("path");

  console.log("[Fullstack] Starting Vite development servers...");

  // For Admin Panel (at /admin)
  const viteAdmin = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
    root: path.resolve(process.cwd(), "artifacts/admin-panel"),
    base: "/admin/",
  });

  // For Marketplace (at /)
  const viteMarketplace = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
    root: path.resolve(process.cwd(), "artifacts/marketplace"),
    base: "/",
  });

  app.use("/admin", viteAdmin.middlewares);
  app.use(viteMarketplace.middlewares);
} else {
  const path = await import("path");
  const adminDist = path.resolve(process.cwd(), "artifacts/admin-panel/dist/public");
  const marketplaceDist = path.resolve(process.cwd(), "artifacts/marketplace/dist/public");

  console.log("[Fullstack] Serving production static files...");

  app.use("/admin", express.static(adminDist));
  app.get("/admin*", (req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });

  app.use(express.static(marketplaceDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(marketplaceDist, "index.html"));
  });
}

// ── Global JSON error handler — يضمن JSON دائماً بدل HTML ──────────────────
// يجب أن يكون بعد كل الـ routes وله 4 معاملات حتى يتعرف عليه Express كـ error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "حدث خطأ في الخادم" });
});

export default app;
