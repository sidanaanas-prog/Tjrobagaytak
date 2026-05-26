import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { contentVideosTable } from "./content_videos";

export const contentViewsTable = pgTable("content_views", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => contentVideosTable.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("content_views_video_user").on(t.videoId, t.userId),
  unique("content_views_video_ip").on(t.videoId, t.ipHash),
]);

export type ContentView = typeof contentViewsTable.$inferSelect;
