import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ── الصيدليات ──────────────────────────────────────────────────────────────
export const pharmaciesTable = pgTable("pharmacies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),                      // اسم الصيدلية
  ownerPhone: text("owner_phone").notNull().unique(), // رقم صاحب الصيدلية (يضيفه الأدمن)
  ownerId: text("owner_id").references(() => usersTable.id), // يُملأ تلقائياً عند دخوله
  logo: text("logo"),
  coverImage: text("cover_image"),
  address: text("address"),
  phone: text("phone"),                              // رقم الصيدلية للعرض
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("10"), // النسبة %
  workHours: text("work_hours").default("8:00 - 22:00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── طاقم الصيدلية (أطباء + صيادلة) ──────────────────────────────────────
export const pharmacyStaffTable = pgTable("pharmacy_staff", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull().references(() => pharmaciesTable.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),                    // الرقم الذي يضيفه صاحب الصيدلية
  userId: text("user_id").references(() => usersTable.id), // يُربط تلقائياً عند التسجيل
  name: text("name").notNull(),
  specialty: text("specialty").notNull().default("صيدلاني"), // صيدلاني / طبيب عام / ...
  status: text("status").notNull().default("pending"),       // pending / active / removed
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── طلبات الوصفات ─────────────────────────────────────────────────────────
export const prescriptionOrdersTable = pgTable("prescription_orders", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  prescriptionUrl: text("prescription_url").notNull(),       // رابط صورة الوصفة
  notes: text("notes"),                                       // ملاحظات المريض
  deliveryType: text("delivery_type").notNull().default("pickup"), // pickup / delivery
  address: text("address"),                                   // عنوان التوصيل
  status: text("status").notNull().default("pending"),        // pending / reviewing / priced / confirmed / ready / delivered / cancelled
  proposedPrice: numeric("proposed_price", { precision: 10, scale: 2 }), // السعر الذي يحدده الصيدلاني
  finalPrice: numeric("final_price", { precision: 10, scale: 2 }),       // بعد موافقة المستخدم
  pharmacistNote: text("pharmacist_note"),                    // ملاحظة الصيدلاني
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }), // العمولة المحسوبة
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── أنواع الفحوصات (يحددها صاحب الصيدلية) ────────────────────────────────
export const pharmacyExamsTable = pgTable("pharmacy_exams", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull().references(() => pharmaciesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),             // فحص ضغط / فحص سكر / ...
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(15),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
});

// ── حجوزات المواعيد ───────────────────────────────────────────────────────
export const pharmacyAppointmentsTable = pgTable("pharmacy_appointments", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  examId: text("exam_id").notNull().references(() => pharmacyExamsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  appointmentDate: text("appointment_date").notNull(),   // YYYY-MM-DD
  appointmentTime: text("appointment_time").notNull(),   // HH:MM
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),   // pending / confirmed / completed / cancelled
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── الاستفسارات الطبية ────────────────────────────────────────────────────
export const pharmacyConsultationsTable = pgTable("pharmacy_consultations", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  imageUrl: text("image_url"),                            // صورة اختيارية
  isPublic: boolean("is_public").notNull().default(true), // عام / خاص
  status: text("status").notNull().default("open"),       // open / answered / closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── ردود الاستفسارات ──────────────────────────────────────────────────────
export const consultationRepliesTable = pgTable("consultation_replies", {
  id: text("id").primaryKey(),
  consultationId: text("consultation_id").notNull().references(() => pharmacyConsultationsTable.id, { onDelete: "cascade" }),
  staffId: text("staff_id").notNull().references(() => usersTable.id),  // الطبيب/الصيدلاني
  reply: text("reply").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Pharmacy = typeof pharmaciesTable.$inferSelect;
export type PharmacyStaff = typeof pharmacyStaffTable.$inferSelect;
export type PrescriptionOrder = typeof prescriptionOrdersTable.$inferSelect;
export type PharmacyAppointment = typeof pharmacyAppointmentsTable.$inferSelect;
export type PharmacyConsultation = typeof pharmacyConsultationsTable.$inferSelect;
