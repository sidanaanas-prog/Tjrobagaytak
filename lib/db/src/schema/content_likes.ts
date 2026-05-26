import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { contentVideosTable } from "./content_videos";

export const contentLikesTable = pgTable("content_likes", {
  videoId: text("video_id").notNull().references(() => contentVideosTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.videoId, t.userId] })]);

export type ContentLike = typeof contentLikesTable.$inferSelect;
