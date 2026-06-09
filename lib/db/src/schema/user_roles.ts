import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userRolesTable = pgTable("user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "seller" | "driver" | "passenger" | "shopper"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRole = typeof userRolesTable.$inferSelect;
export type InsertUserRole = typeof userRolesTable.$inferInsert;
