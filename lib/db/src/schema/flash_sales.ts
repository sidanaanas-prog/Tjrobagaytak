import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const flashSalesTable = pgTable("flash_sales", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export type FlashSale = typeof flashSalesTable.$inferSelect;
