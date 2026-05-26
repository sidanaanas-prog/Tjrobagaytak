import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const orderStatusEnum = z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => productsTable.id),
  buyerId: text("buyer_id").notNull().references(() => usersTable.id),
  sellerId: text("seller_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("pending"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  shippingAddress: text("shipping_address"),
  phone: text("phone"),
  notes: text("notes"),
  deliveryType: text("delivery_type"),   // null | 'self' | 'service'
  deliveryStatus: text("delivery_status"), // null | 'pending' | 'accepted' | 'rejected' | 'in_transit' | 'delivered'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
