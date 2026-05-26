import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const postViewsTable = pgTable("post_views", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostViewSchema = createInsertSchema(postViewsTable).omit({ createdAt: true });
export type InsertPostView = z.infer<typeof insertPostViewSchema>;
export type PostView = typeof postViewsTable.$inferSelect;
