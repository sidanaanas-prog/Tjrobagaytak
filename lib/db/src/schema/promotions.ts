import { pgTable, text, boolean, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const promotionsTable = pgTable("promotions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),               // اسم العرض
  description: text("description"),           // وصف العرض
  type: text("type").notNull(),               // 'challenge' | 'discount' | 'flash'
  plan: text("plan").notNull(),               // '6months' | '12months' | 'both'
  originalPrice: numeric("original_price").notNull(),    // السعر الأصلي
  discountedPrice: numeric("discounted_price").notNull(), // السعر بعد الخصم
  discountPercent: integer("discount_percent").notNull(), // نسبة الخصم
  isActive: boolean("is_active").notNull().default(true),
  startAt: timestamp("start_at", { withTimezone: true }),     // تاريخ البداية
  endAt: timestamp("end_at", { withTimezone: true }),         // تاريخ النهاية
  trialDays: integer("trial_days"),           // أيام تجريبية (للـ challenge)
  goalDescription: text("goal_description"),  // شرط التحدي (مثال: "بِع منتج واحد في 7 أيام")
  reward: text("reward"),                     // المكافأة (مثال: "شهر مجاني")
  showCountdown: boolean("show_countdown").notNull().default(false), // عدّ تنازلي
  countdownMessage: text("countdown_message"), // رسالة العدّ التنازلي
  maxUsers: integer("max_users"),             // عدد المستخدمين المحدود
  usedCount: integer("used_count").notNull().default(0), // عدد المستخدمين
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
