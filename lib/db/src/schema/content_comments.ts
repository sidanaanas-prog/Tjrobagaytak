import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { contentVideosTable } from "./content_videos";

export const contentCommentsTable = pgTable("content_comments", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => contentVideosTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentComment = typeof contentCommentsTable.$inferSelect;
