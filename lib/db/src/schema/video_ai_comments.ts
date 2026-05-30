import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { contentVideosTable } from "./content_videos";

export const videoAiCommentsTable = pgTable("video_ai_comments", {
  videoId: text("video_id").primaryKey().references(() => contentVideosTable.id, { onDelete: "cascade" }),
  comments: text("comments").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VideoAiComments = typeof videoAiCommentsTable.$inferSelect;
