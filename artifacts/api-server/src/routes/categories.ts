import { Router, type IRouter } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const productCounts = await db
    .select({ categoryId: productsTable.categoryId, cnt: count() })
    .from(productsTable)
    .where(eq(productsTable.status, "active"))
    .groupBy(productsTable.categoryId);
  const countMap = Object.fromEntries(productCounts.map((p) => [p.categoryId, Number(p.cnt)]));
  res.json(categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, productCount: countMap[c.id] ?? 0 })));
});

router.post("/categories", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { name, icon } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({ id: randomUUID(), name, icon: icon ?? null }).returning();
  res.status(201).json({ id: cat.id, name: cat.name, icon: cat.icon, productCount: 0 });
});

router.delete("/categories/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [cat] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id as string)).returning();
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json({ message: "Category deleted" });
});

export default router;
