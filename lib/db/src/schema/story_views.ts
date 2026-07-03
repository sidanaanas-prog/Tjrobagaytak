import { pgTable, text, timestamp, primaryKey, uuid } from "drizzle-orm/pg-core";
import { storiesTable } from "./stories";
import { usersTable } from "./users";

export const storyViewsTable = pgTable("story_views", {
  storyId: text("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  viewerId: uuid("viewer_id"),
}, (t) => [primaryKey({ columns: [t.storyId, t.userId] })]);

export type StoryView = typeof storyViewsTable.$inferSelect;
