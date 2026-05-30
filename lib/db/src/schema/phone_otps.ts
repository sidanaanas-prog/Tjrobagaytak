import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const phoneOtpsTable = pgTable("phone_otps", {
  phone:     text("phone").primaryKey(),
  code:      text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  sentAt:    timestamp("sent_at",    { withTimezone: true }).notNull().defaultNow(),
  attempts:  integer("attempts").notNull().default(0),
});
