import { pgTable, text, boolean, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  pushToken: text("push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  tokenIssuedAfter: timestamp("token_issued_after", { withTimezone: true }),
  streakCount: integer("streak_count").notNull().default(0),
  streakLastDate: date("streak_last_date"),
  missYouNotifiedAt: timestamp("miss_you_notified_at", { withTimezone: true }),
  isVerified: boolean("is_verified").notNull().default(false),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  isFree: boolean("is_free").notNull().default(false),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  sellerIdDocument: text("seller_id_document"),
  pinHash: text("pin_hash"),
  // عداد تبليغ "لم يأتِ" كراكب (للعقوبات)
  noShowCount: integer("no_show_count").notNull().default(0),
  noShowLastAt: timestamp("no_show_last_at", { withTimezone: true }),
  // حظر مؤقت الرحلات
  rideBannedUntil: timestamp("ride_banned_until", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
