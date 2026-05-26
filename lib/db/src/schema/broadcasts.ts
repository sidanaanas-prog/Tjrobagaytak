import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const broadcastsTable = pgTable("broadcasts", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull().references(() => usersTable.id),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Broadcast = typeof broadcastsTable.$inferSelect;
