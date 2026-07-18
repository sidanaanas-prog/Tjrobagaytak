import { pgTable, text, numeric, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ridesTable = pgTable("rides", {
  id: text("id").primaryKey(),
  passengerId: text("passenger_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  driverId: text("driver_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "picked_up" | "completed" | "cancelled"
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  fromLat: numeric("from_lat"),
  fromLng: numeric("from_lng"),
  toLat: numeric("to_lat"),
  toLng: numeric("to_lng"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  distance: numeric("distance"), // km
  notes: text("notes"),
  passengerCount: integer("passenger_count").default(1), // عدد الركاب
  vehicleType: text("vehicle_type").default("car"), // "car" | "ac" | "suv" | "van" | "truck"
  rating: integer("rating"), // 1-5
  driverRating: integer("driver_rating"), // 1-5
  passengerRating: integer("passenger_rating"), // 1-5
  review: text("review"),
  driverReview: text("driver_review"),
  cancelledBy: text("cancelled_by"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // تتبع موقع السائق مباشر
  driverLat: numeric("driver_lat"),
  driverLng: numeric("driver_lng"),
  driverLocationUpdatedAt: timestamp("driver_location_updated_at", { withTimezone: true }),
  // تبليغ الراكب لم يأتِ
  riderNoShow: boolean("rider_no_show").default(false),
  riderNoShowAt: timestamp("rider_no_show_at", { withTimezone: true }),
  // دفع
  paymentMethod: text("payment_method").default("cash"), // "cash" | "wallet"
  estimatedPrice: numeric("estimated_price", { precision: 12, scale: 2 }),
  actualPrice: numeric("actual_price", { precision: 12, scale: 2 }),
  completionCode: text("completion_code"), // كود إنهاء الرحلة لتفادي التحايل
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ride = typeof ridesTable.$inferSelect;
export type InsertRide = typeof ridesTable.$inferInsert;

export const driverProfilesTable = pgTable("driver_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  vehicleType: text("vehicle_type"), // "car" | "ac" | "suv" | "van" | "truck"
  vehicleModel: text("vehicle_model"),
  vehiclePlate: text("vehicle_plate"),
  vehicleColor: text("vehicle_color"),
  isAvailable: boolean("is_available").notNull().default(true),
  isOnline: boolean("is_online").notNull().default(false),
  currentLat: numeric("current_lat"),
  currentLng: numeric("current_lng"),
  totalRides: integer("total_rides").notNull().default(0),
  totalEarnings: numeric("total_earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).notNull().default("0"),
  ratingCount: integer("rating_count").notNull().default(0),
  // اشتراك السائق الشهري
  isSubscribed: boolean("is_subscribed").notNull().default(false),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  // سائق مجاني (يعمل بدون دفع اشتراك)
  isFree: boolean("is_free").notNull().default(false),
  freeRidesLeft: integer("free_rides_left").notNull().default(0), // عدد الرحلات المجانية المتبقية للسائق (أول 5 رحلات مجانية)
  // تجربة مجانية 7 أيام للسائقين الجدد
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  // وثائق السائق
  licenseImage: text("license_image"), // صورة رخصة القيادة
  idCardImage: text("id_card_image"), // صورة بطاقة الهوية
  vehicleDocImage: text("vehicle_doc_image"), // صورة رخصة السير
  licenseVerified: boolean("license_verified").notNull().default(false),
  documentsStatus: text("documents_status").default("pending"), // "pending" | "verified" | "rejected"
  documentsSubmittedAt: timestamp("documents_submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DriverProfile = typeof driverProfilesTable.$inferSelect;
export type InsertDriverProfile = typeof driverProfilesTable.$inferInsert;

// وجهات مسبقة التعريف وأسعارها (لوحة التحكم)
export const destinationsTable = pgTable("destinations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // اسم الوجهة (مثل وسط المدينة، المطار، إلخ)
  price: numeric("price", { precision: 12, scale: 2 }).notNull(), // السعر المقترح
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Destination = typeof destinationsTable.$inferSelect;
export type InsertDestination = typeof destinationsTable.$inferInsert;

// إعدادات الرحلات والعمولة المخصصة
export const rideSettingsTable = pgTable("ride_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RideSetting = typeof rideSettingsTable.$inferSelect;
export type InsertRideSetting = typeof rideSettingsTable.$inferInsert;

