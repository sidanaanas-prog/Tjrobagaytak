import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  caption: text("caption"),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  thumbnailUrl: text("thumbnail_url"),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  viewsCount: integer("views_count").notNull().default(0),
  sharesCount: integer("shares_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("posts_created_at_idx").on(t.createdAt),
  index("posts_user_id_idx").on(t.userId),
]);

export const insertPostSchema = createInsertSchema(postsTable).omit({ createdAt: true, likesCount: true, commentsCount: true, viewsCount: true, sharesCount: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
