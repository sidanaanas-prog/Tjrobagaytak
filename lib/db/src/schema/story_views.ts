import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { storiesTable } from "./stories";
import { usersTable } from "./users";

export const storyViewsTable = pgTable("story_views", {
  storyId: text("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  viewerId: text("viewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.storyId, t.viewerId] })]);

export type StoryView = typeof storyViewsTable.$inferSelect;
