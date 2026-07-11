import { pgTable, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("seller"), // 'seller' | 'driver' | 'restaurant'
  restaurantId: text("restaurant_id"),     // مرتبط بالمطعم إذا كان النوع restaurant
  restaurantName: text("restaurant_name"), // اسم المطعم للعرض
  plan: text("plan").notNull(),             // '1month' | '6months' | '12months'
  paymentMethod: text("payment_method").notNull(), // 'ccp' | 'cash'
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  price: numeric("price").notNull(),
  paymentProofUrl: text("payment_proof_url"), // CCP: صورة وصل
  idDocumentUrl: text("id_document_url"),    // نقدي: صورة وثيقة
  notes: text("notes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
