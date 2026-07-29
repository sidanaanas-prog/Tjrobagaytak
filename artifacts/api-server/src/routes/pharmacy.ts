import { Router } from "express";
import { db, pharmaciesTable, pharmacyStaffTable, prescriptionOrdersTable, pharmacyExamsTable, pharmacyAppointmentsTable, pharmacyConsultationsTable, consultationRepliesTable, usersTable } from "@workspace/db";
import { eq, desc, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, requireAdmin } from "../lib/auth";

const router = Router();

// ─── مساعد: جلب الصيدلية بواسطة userId ─────────────────────────────────
async function getPharmacyByOwner(userId: string) {
  const [p] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.ownerId, userId))) ?? [];
  return p ?? null;
}

async function getPharmacyByStaff(userId: string) {
  const [s] = (await db.select().from(pharmacyStaffTable).where(and(eq(pharmacyStaffTable.userId, userId), eq(pharmacyStaffTable.status, "active")))) ?? [];
  if (!s) return null;
  const [p] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, s.pharmacyId))) ?? [];
  return p ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── معلومات الصيدلية الأساسية ──────────────────────────────────────────────
router.get("/pharmacy", async (req, res): Promise<void> => {
  try {
    const [pharmacy] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.isActive, true)).limit(1)) ?? [];
    if (!pharmacy) { res.status(404).json({ error: "الصيدلية غير موجودة" }); return; }
    res.json(pharmacy);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── الفحوصات المتاحة ───────────────────────────────────────────────────────
router.get("/pharmacy/exams", async (req, res): Promise<void> => {
  try {
    const [pharmacy] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.isActive, true)).limit(1)) ?? [];
    if (!pharmacy) { res.json([]); return; }
    const exams = (await db.select().from(pharmacyExamsTable)
      .where(and(eq(pharmacyExamsTable.pharmacyId, pharmacy.id), eq(pharmacyExamsTable.isActive, true)))
      .orderBy(pharmacyExamsTable.sortOrder)) ?? [];
    res.json(exams);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── الاستفسارات العامة ─────────────────────────────────────────────────────
router.get("/pharmacy/consultations", async (req, res): Promise<void> => {
  try {
    const [pharmacy] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.isActive, true)).limit(1)) ?? [];
    if (!pharmacy) { res.json([]); return; }
    const consultations = (await db.select({
      id: pharmacyConsultationsTable.id,
      question: pharmacyConsultationsTable.question,
      imageUrl: pharmacyConsultationsTable.imageUrl,
      status: pharmacyConsultationsTable.status,
      createdAt: pharmacyConsultationsTable.createdAt,
      userName: usersTable.name,
    })
      .from(pharmacyConsultationsTable)
      .innerJoin(usersTable, eq(pharmacyConsultationsTable.userId, usersTable.id))
      .where(and(eq(pharmacyConsultationsTable.pharmacyId, pharmacy.id), eq(pharmacyConsultationsTable.isPublic, true)))
      .orderBy(desc(pharmacyConsultationsTable.createdAt))
      .limit(30)) ?? [];

    // جلب الردود
    const result = await Promise.all(consultations.map(async (c) => {
      const replies = (await db.select({
        id: consultationRepliesTable.id,
        reply: consultationRepliesTable.reply,
        createdAt: consultationRepliesTable.createdAt,
        staffName: usersTable.name,
      })
        .from(consultationRepliesTable)
        .innerJoin(usersTable, eq(consultationRepliesTable.staffId, usersTable.id))
        .where(eq(consultationRepliesTable.consultationId, c.id))) ?? [];
      return { ...c, replies };
    }));

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// USER ROUTES (تتطلب تسجيل دخول)
// ═══════════════════════════════════════════════════════════════════════════

// ── إرسال طلب وصفة ────────────────────────────────────────────────────────
router.post("/pharmacy/prescriptions", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { prescriptionUrl, notes, deliveryType, address } = req.body;
    if (!prescriptionUrl) { res.status(400).json({ error: "صورة الوصفة مطلوبة" }); return; }

    const [pharmacy] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.isActive, true)).limit(1)) ?? [];
    if (!pharmacy) { res.status(404).json({ error: "الصيدلية غير متوفرة" }); return; }

    const id = randomUUID();
    await db.insert(prescriptionOrdersTable).values({
      id, pharmacyId: pharmacy.id, userId, prescriptionUrl,
      notes: notes || null, deliveryType: deliveryType || "pickup",
      address: address || null, status: "pending",
    });
    res.status(201).json({ id, message: "تم إرسال طلبك بنجاح، سيتواصل معك الصيدلاني قريباً" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── حجز موعد فحص ──────────────────────────────────────────────────────────
router.post("/pharmacy/appointments", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { examId, appointmentDate, appointmentTime, patientName, patientPhone, notes } = req.body;
    if (!examId || !appointmentDate || !appointmentTime || !patientName || !patientPhone) {
      res.status(400).json({ error: "جميع الحقول مطلوبة" }); return;
    }

    const [exam] = (await db.select().from(pharmacyExamsTable).where(eq(pharmacyExamsTable.id, examId))) ?? [];
    if (!exam) { res.status(404).json({ error: "نوع الفحص غير موجود" }); return; }

    const id = randomUUID();
    const commission = (Number(exam.price) * Number((await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, exam.pharmacyId)).limit(1))[0]?.commissionRate ?? 10) / 100).toFixed(2);
    await db.insert(pharmacyAppointmentsTable).values({
      id, pharmacyId: exam.pharmacyId, examId, userId,
      appointmentDate, appointmentTime, patientName, patientPhone,
      notes: notes || null, status: "pending", price: exam.price,
      commissionAmount: commission,
    });
    res.status(201).json({ id, message: "تم الحجز بنجاح، سيتم تأكيده قريباً" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── طرح استفسار ────────────────────────────────────────────────────────────
router.post("/pharmacy/consultations", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { question, imageUrl, isPublic } = req.body;
    if (!question?.trim()) { res.status(400).json({ error: "السؤال مطلوب" }); return; }

    const [pharmacy] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.isActive, true)).limit(1)) ?? [];
    if (!pharmacy) { res.status(404).json({ error: "الصيدلية غير متوفرة" }); return; }

    const id = randomUUID();
    await db.insert(pharmacyConsultationsTable).values({
      id, pharmacyId: pharmacy.id, userId,
      question: question.trim(), imageUrl: imageUrl || null,
      isPublic: isPublic !== false, status: "open",
    });
    res.status(201).json({ id, message: "تم إرسال سؤالك، سيرد عليك الطبيب قريباً" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── طلبات المستخدم الخاصة ──────────────────────────────────────────────────
router.get("/pharmacy/my-prescriptions", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const orders = (await db.select().from(prescriptionOrdersTable)
      .where(eq(prescriptionOrdersTable.userId, userId))
      .orderBy(desc(prescriptionOrdersTable.createdAt))) ?? [];
    res.json(orders);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/my-appointments", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const appointments = (await db.select({
      id: pharmacyAppointmentsTable.id,
      appointmentDate: pharmacyAppointmentsTable.appointmentDate,
      appointmentTime: pharmacyAppointmentsTable.appointmentTime,
      patientName: pharmacyAppointmentsTable.patientName,
      status: pharmacyAppointmentsTable.status,
      price: pharmacyAppointmentsTable.price,
      createdAt: pharmacyAppointmentsTable.createdAt,
      examName: pharmacyExamsTable.name,
    })
      .from(pharmacyAppointmentsTable)
      .innerJoin(pharmacyExamsTable, eq(pharmacyAppointmentsTable.examId, pharmacyExamsTable.id))
      .where(eq(pharmacyAppointmentsTable.userId, userId))
      .orderBy(desc(pharmacyAppointmentsTable.createdAt))) ?? [];
    res.json(appointments);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PHARMACY OWNER DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── التحقق من كون المستخدم صاحب صيدلية أو طاقم ────────────────────────────
router.get("/pharmacy/me", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userPhone = (req as any).user.phone;

    // ربط تلقائي: هل هذا الرقم مضاف كصاحب صيدلية؟
    const [pendingPharmacy] = (await db.select().from(pharmaciesTable)
      .where(and(eq(pharmaciesTable.ownerPhone, userPhone ?? ""), eq(pharmaciesTable.ownerId, userId === null ? userId : ""))).limit(1)) ?? [];

    // تحقق إذا كان ownerId فارغ وهاتفه يطابق ownerPhone
    const [unlinked] = (await db
      .select().from(pharmaciesTable)
      .where(eq(pharmaciesTable.ownerPhone, userPhone ?? "")).limit(1)) ?? [];

    if (unlinked && !unlinked.ownerId) {
      // ربط تلقائي
      await db.update(pharmaciesTable).set({ ownerId: userId }).where(eq(pharmaciesTable.id, unlinked.id));
      res.json({ role: "pharmacy_owner", pharmacy: { ...unlinked, ownerId: userId } });
      return;
    }

    const ownerPharmacy = await getPharmacyByOwner(userId);
    if (ownerPharmacy) { res.json({ role: "pharmacy_owner", pharmacy: ownerPharmacy }); return; }

    // تحقق إذا كان طاقم طبي
    const [staffRecord] = (await db.select().from(pharmacyStaffTable)
      .where(eq(pharmacyStaffTable.phone, userPhone ?? "")).limit(1)) ?? [];

    if (staffRecord && !staffRecord.userId) {
      await db.update(pharmacyStaffTable).set({ userId, status: "active" }).where(eq(pharmacyStaffTable.id, staffRecord.id));
      const [p] = (await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, staffRecord.pharmacyId))) ?? [];
      res.json({ role: "pharmacy_staff", pharmacy: p, staffInfo: { ...staffRecord, userId } });
      return;
    }

    const staffPharmacy = await getPharmacyByStaff(userId);
    if (staffPharmacy) {
      const [staffInfo] = (await db.select().from(pharmacyStaffTable).where(eq(pharmacyStaffTable.userId, userId))) ?? [];
      res.json({ role: "pharmacy_staff", pharmacy: staffPharmacy, staffInfo });
      return;
    }

    res.json({ role: "user", pharmacy: null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── طلبات الوصفات (لوحة الصيدلاني) ───────────────────────────────────────
router.get("/pharmacy/owner/prescriptions", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }

    const orders = (await db.select({
      id: prescriptionOrdersTable.id,
      prescriptionUrl: prescriptionOrdersTable.prescriptionUrl,
      notes: prescriptionOrdersTable.notes,
      deliveryType: prescriptionOrdersTable.deliveryType,
      address: prescriptionOrdersTable.address,
      status: prescriptionOrdersTable.status,
      proposedPrice: prescriptionOrdersTable.proposedPrice,
      finalPrice: prescriptionOrdersTable.finalPrice,
      pharmacistNote: prescriptionOrdersTable.pharmacistNote,
      createdAt: prescriptionOrdersTable.createdAt,
      patientName: usersTable.name,
      patientPhone: usersTable.phone,
    })
      .from(prescriptionOrdersTable)
      .innerJoin(usersTable, eq(prescriptionOrdersTable.userId, usersTable.id))
      .where(eq(prescriptionOrdersTable.pharmacyId, pharmacy.id))
      .orderBy(desc(prescriptionOrdersTable.createdAt))) ?? [];
    res.json(orders);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── تحديث حالة طلب الوصفة (تحديد السعر / قبول / رفض) ───────────────────
router.patch("/pharmacy/owner/prescriptions/:id", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }

    const { status, proposedPrice, pharmacistNote } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (proposedPrice) {
      updates.proposedPrice = proposedPrice;
      updates.commissionAmount = (Number(proposedPrice) * Number(pharmacy.commissionRate) / 100).toFixed(2);
    }
    if (pharmacistNote !== undefined) updates.pharmacistNote = pharmacistNote;

    await db.update(prescriptionOrdersTable).set(updates).where(and(
      eq(prescriptionOrdersTable.id, req.params.id),
      eq(prescriptionOrdersTable.pharmacyId, pharmacy.id)
    ));
    res.json({ message: "تم التحديث" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── حجوزات المواعيد (لوحة الصيدلاني) ────────────────────────────────────
router.get("/pharmacy/owner/appointments", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }

    const appointments = (await db.select({
      id: pharmacyAppointmentsTable.id,
      appointmentDate: pharmacyAppointmentsTable.appointmentDate,
      appointmentTime: pharmacyAppointmentsTable.appointmentTime,
      patientName: pharmacyAppointmentsTable.patientName,
      patientPhone: pharmacyAppointmentsTable.patientPhone,
      notes: pharmacyAppointmentsTable.notes,
      status: pharmacyAppointmentsTable.status,
      price: pharmacyAppointmentsTable.price,
      createdAt: pharmacyAppointmentsTable.createdAt,
      examName: pharmacyExamsTable.name,
    })
      .from(pharmacyAppointmentsTable)
      .innerJoin(pharmacyExamsTable, eq(pharmacyAppointmentsTable.examId, pharmacyExamsTable.id))
      .where(eq(pharmacyAppointmentsTable.pharmacyId, pharmacy.id))
      .orderBy(desc(pharmacyAppointmentsTable.createdAt))) ?? [];
    res.json(appointments);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/pharmacy/owner/appointments/:id", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    await db.update(pharmacyAppointmentsTable).set({ status: req.body.status })
      .where(and(eq(pharmacyAppointmentsTable.id, req.params.id), eq(pharmacyAppointmentsTable.pharmacyId, pharmacy.id)));
    res.json({ message: "تم التحديث" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── إدارة الفحوصات ────────────────────────────────────────────────────────
router.get("/pharmacy/owner/exams", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    const exams = (await db.select().from(pharmacyExamsTable).where(eq(pharmacyExamsTable.pharmacyId, pharmacy.id)).orderBy(pharmacyExamsTable.sortOrder)) ?? [];
    res.json(exams);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/owner/exams", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    const { name, description, price, durationMinutes } = req.body;
    if (!name || !price) { res.status(400).json({ error: "الاسم والسعر مطلوبان" }); return; }
    const id = randomUUID();
    await db.insert(pharmacyExamsTable).values({ id, pharmacyId: pharmacy.id, name, description: description || null, price, durationMinutes: durationMinutes || 15 });
    res.status(201).json({ id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/pharmacy/owner/exams/:id", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    await db.delete(pharmacyExamsTable).where(and(eq(pharmacyExamsTable.id, req.params.id), eq(pharmacyExamsTable.pharmacyId, pharmacy.id)));
    res.json({ message: "تم الحذف" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── إدارة الطاقم الطبي ────────────────────────────────────────────────────
router.get("/pharmacy/owner/staff", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    const staff = (await db.select().from(pharmacyStaffTable).where(eq(pharmacyStaffTable.pharmacyId, pharmacy.id)).orderBy(pharmacyStaffTable.addedAt)) ?? [];
    res.json(staff);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/owner/staff", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    const { phone, name, specialty } = req.body;
    if (!phone || !name) { res.status(400).json({ error: "الرقم والاسم مطلوبان" }); return; }

    // هل الرقم مسجل مسبقاً؟
    const [existingUser] = (await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1)) ?? [];
    const id = randomUUID();
    await db.insert(pharmacyStaffTable).values({
      id, pharmacyId: pharmacy.id, phone, name,
      specialty: specialty || "طبيب",
      userId: existingUser?.id ?? null,
      status: existingUser ? "active" : "pending",
    });
    res.status(201).json({ id, message: existingUser ? "تم الربط تلقائياً" : "في انتظار تسجيل الطبيب" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/pharmacy/owner/staff/:id", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pharmacy = await getPharmacyByOwner(userId);
    if (!pharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }
    await db.update(pharmacyStaffTable).set({ status: "removed" })
      .where(and(eq(pharmacyStaffTable.id, req.params.id), eq(pharmacyStaffTable.pharmacyId, pharmacy.id)));
    res.json({ message: "تم الإزالة" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── الاستفسارات (لوحة الطاقم الطبي) ──────────────────────────────────────
router.get("/pharmacy/staff/consultations", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userPhone = (req as any).user.phone;
    const [staffRecord] = (await db.select().from(pharmacyStaffTable)
      .where(or(eq(pharmacyStaffTable.userId, userId), eq(pharmacyStaffTable.phone, userPhone ?? ""))).limit(1)) ?? [];
    if (!staffRecord) { res.status(403).json({ error: "غير مصرح" }); return; }

    const consultations = (await db.select({
      id: pharmacyConsultationsTable.id,
      question: pharmacyConsultationsTable.question,
      imageUrl: pharmacyConsultationsTable.imageUrl,
      status: pharmacyConsultationsTable.status,
      isPublic: pharmacyConsultationsTable.isPublic,
      createdAt: pharmacyConsultationsTable.createdAt,
      patientName: usersTable.name,
    })
      .from(pharmacyConsultationsTable)
      .innerJoin(usersTable, eq(pharmacyConsultationsTable.userId, usersTable.id))
      .where(eq(pharmacyConsultationsTable.pharmacyId, staffRecord.pharmacyId))
      .orderBy(desc(pharmacyConsultationsTable.createdAt))) ?? [];

    const result = await Promise.all(consultations.map(async (c) => {
      const replies = (await db.select({
        id: consultationRepliesTable.id,
        reply: consultationRepliesTable.reply,
        createdAt: consultationRepliesTable.createdAt,
        staffName: usersTable.name,
      })
        .from(consultationRepliesTable)
        .innerJoin(usersTable, eq(consultationRepliesTable.staffId, usersTable.id))
        .where(eq(consultationRepliesTable.consultationId, c.id))) ?? [];
      return { ...c, replies };
    }));
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/consultations/:id/reply", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userPhone = (req as any).user.phone;
    // صاحب الصيدلية أو طاقم طبي
    const [staffRecord] = (await db.select().from(pharmacyStaffTable)
      .where(or(eq(pharmacyStaffTable.userId, userId), eq(pharmacyStaffTable.phone, userPhone ?? ""))).limit(1)) ?? [];
    const ownerPharmacy = await getPharmacyByOwner(userId);
    if (!staffRecord && !ownerPharmacy) { res.status(403).json({ error: "غير مصرح" }); return; }

    const { reply } = req.body;
    if (!reply?.trim()) { res.status(400).json({ error: "الرد مطلوب" }); return; }

    const id = randomUUID();
    await db.insert(consultationRepliesTable).values({ id, consultationId: req.params.id, staffId: userId, reply: reply.trim() });
    await db.update(pharmacyConsultationsTable).set({ status: "answered" }).where(eq(pharmacyConsultationsTable.id, req.params.id));
    res.status(201).json({ id, message: "تم إرسال الرد" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (أدمن)
// ═══════════════════════════════════════════════════════════════════════════

// ── قائمة الصيدليات ────────────────────────────────────────────────────────
router.get("/admin/pharmacies", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const pharmacies = (await db.select().from(pharmaciesTable).orderBy(desc(pharmaciesTable.createdAt))) ?? [];
    res.json(pharmacies);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── إضافة صيدلية ───────────────────────────────────────────────────────────
router.post("/admin/pharmacies", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const { name, ownerPhone, logo, address, phone, description, commissionRate, workHours } = req.body;
    if (!name || !ownerPhone) { res.status(400).json({ error: "الاسم ورقم المالك مطلوبان" }); return; }

    // هل المالك مسجل؟
    const [existingOwner] = (await db.select().from(usersTable).where(eq(usersTable.phone, ownerPhone)).limit(1)) ?? [];
    const id = randomUUID();
    await db.insert(pharmaciesTable).values({
      id, name, ownerPhone, ownerId: existingOwner?.id ?? null,
      logo: logo || null, address: address || null, phone: phone || ownerPhone,
      description: description || null, commissionRate: commissionRate || "10",
      workHours: workHours || "8:00 - 22:00",
    });
    res.status(201).json({ id, message: "تمت إضافة الصيدلية" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── تعديل صيدلية ───────────────────────────────────────────────────────────
router.patch("/admin/pharmacies/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const { name, ownerPhone, commissionRate, isActive, address, phone, description, workHours } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (ownerPhone !== undefined) updates.ownerPhone = ownerPhone;
    if (commissionRate !== undefined) updates.commissionRate = commissionRate;
    if (isActive !== undefined) updates.isActive = isActive;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (description !== undefined) updates.description = description;
    if (workHours !== undefined) updates.workHours = workHours;
    await db.update(pharmaciesTable).set(updates).where(eq(pharmaciesTable.id, req.params.id));
    res.json({ message: "تم التحديث" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── تقرير عمولات ───────────────────────────────────────────────────────────
router.get("/admin/pharmacies/:id/revenue", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const prescriptions = (await db.select().from(prescriptionOrdersTable)
      .where(and(eq(prescriptionOrdersTable.pharmacyId, req.params.id), eq(prescriptionOrdersTable.status, "delivered")))) ?? [];
    const appointments = (await db.select().from(pharmacyAppointmentsTable)
      .where(and(eq(pharmacyAppointmentsTable.pharmacyId, req.params.id), eq(pharmacyAppointmentsTable.status, "completed")))) ?? [];

    const totalPrescriptions = prescriptions.reduce((s, o) => s + Number(o.finalPrice ?? 0), 0);
    const totalAppointments = appointments.reduce((s, a) => s + Number(a.price ?? 0), 0);
    const commissionPrescriptions = prescriptions.reduce((s, o) => s + Number(o.commissionAmount ?? 0), 0);
    const commissionAppointments = appointments.reduce((s, a) => s + Number(a.commissionAmount ?? 0), 0);

    res.json({
      totalSales: (totalPrescriptions + totalAppointments).toFixed(2),
      totalCommission: (commissionPrescriptions + commissionAppointments).toFixed(2),
      prescriptionsCount: prescriptions.length,
      appointmentsCount: appointments.length,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
