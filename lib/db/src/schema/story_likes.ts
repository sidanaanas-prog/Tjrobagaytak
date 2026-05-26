import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { storiesTable } from "./stories";
import { usersTable } from "./users";

export const storyLikesTable = pgTable("story_likes", {
  storyId: text("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  likedAt: timestamp("liked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.storyId, t.userId] })]);

export type StoryLike = typeof storyLikesTable.$inferSelect;
