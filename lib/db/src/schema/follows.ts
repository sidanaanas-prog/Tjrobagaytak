import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const followsTable = pgTable("follows", {
  followerId: text("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sellerId: text("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.followerId, t.sellerId] })]);

export type Follow = typeof followsTable.$inferSelect;
