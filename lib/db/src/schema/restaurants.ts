import { pgTable, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const restaurantsTable = pgTable("restaurants", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  logo: text("logo"),
  coverImage: text("cover_image"),
  category: text("category").notNull().default("عام"),
  address: text("address").notNull(),
  lat: numeric("lat"),
  lng: numeric("lng"),
  phone: text("phone"),
  isOpen: boolean("is_open").default(true),
  status: text("status").notNull().default("pending"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  minOrder: numeric("min_order", { precision: 10, scale: 2 }).default("0"),
  estimatedDeliveryMinutes: integer("estimated_delivery_minutes").default(30),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  ratingCount: integer("rating_count").default(0),
  isFeatured: boolean("is_featured").default(false),
  isSubscribed: boolean("is_subscribed").default(false),
  subscriptionPlan: text("subscription_plan").default("free"),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuItemsTable = pgTable("menu_items", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull().default("الرئيسية"),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  image: text("image"),
  isAvailable: boolean("is_available").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foodOrdersTable = pgTable("food_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  restaurantId: text("restaurant_id").notNull().references(() => restaurantsTable.id),
  driverId: text("driver_id").references(() => usersTable.id, { onDelete: "set null" }),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  status: text("status").notNull().default("pending"),
  deliveryAddress: text("delivery_address").notNull(),
  notes: text("notes"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  items: text("items").notNull(),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const restaurantDriversTable = pgTable("restaurant_drivers", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Restaurant = typeof restaurantsTable.$inferSelect;
export type MenuItem = typeof menuItemsTable.$inferSelect;
export type FoodOrder = typeof foodOrdersTable.$inferSelect;
export type RestaurantDriver = typeof restaurantDriversTable.$inferSelect;
