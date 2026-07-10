import { Router, type IRouter } from "express";
import { db, ridesTable, driverProfilesTable, userRolesTable, usersTable, subscriptionsTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, desc, and, or, isNull, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, requireAdmin } from "../lib/auth";
import { notifyUsers } from "../lib/notifications";

const router: IRouter = Router();

// ── إنشاء طلب نقل (الراكب) ──────────────────────────────────────────────────
router.post("/rides", authenticate, async (req, res): Promise<void> => {
  try {
    const { fromAddress, toAddress, fromLat, fromLng, toLat, toLng, price, notes, passengerCount, vehicleType } = req.body;
    const passengerId = (req as any).user.id;

    const id = randomUUID();
    const now = new Date();
    const vType = vehicleType && ["car","ac","suv","van","truck"].includes(vehicleType) ? vehicleType : "car";

    await db.insert(ridesTable).values({
      id,
      passengerId,
      status: "pending",
      fromAddress,
      toAddress,
      fromLat: fromLat ?? null,
      fromLng: fromLng ?? null,
      toLat: toLat ?? null,
      toLng: toLng ?? null,
      price: String(price),
      notes: notes ?? null,
      passengerCount: passengerCount ? Number(passengerCount) : 1,
      vehicleType: vType,
      createdAt: now,
      updatedAt: now,
    });

    // إشعار السائقين المشتركين المتاحين أو المجانيين أو في التجربة
    // فقط السائقين بنفس نوع السيارة يتلقون الطلب
    const typeFilter = vType === "car" ? undefined : eq(driverProfilesTable.vehicleType, vType);
    const conditions = [
      eq(driverProfilesTable.isOnline, true),
      eq(driverProfilesTable.isAvailable, true),
      or(
        eq(driverProfilesTable.isFree, true),
        and(
          eq(driverProfilesTable.isSubscribed, true),
          sql`${driverProfilesTable.subscriptionExpiresAt} > ${now}`,
        ),
        sql`${driverProfilesTable.trialExpiresAt} > ${now}`,
      ),
    ];
    if (typeFilter) conditions.push(typeFilter);

    const drivers = (await db
      .select({ userId: driverProfilesTable.userId, vehicleType: driverProfilesTable.vehicleType })
      .from(driverProfilesTable)
      .where(and(...conditions))) ?? [];

    if (drivers.length > 0) {
      await notifyUsers({
        userIds: drivers.map((d) => d.userId),
        title: "طلب نقل جديد! 🚕",
        body: `${fromAddress} → ${toAddress} | ${vTypeLabel(vType)}`,
        data: {
          type: "new_ride",
          rideId: id,
          _fromAddress: fromAddress,
          _toAddress: toAddress,
          _price: String(price),
          _vehicleType: vType,
        },
      });
    }

    res.json({ id, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function vTypeLabel(t: string): string {
  const map: Record<string, string> = {
    car: "🚗 عادي",
    ac: "❄️ مكيف",
    suv: "🚙 دفع رباعي",
    van: "🚐 حافلة",
    truck: "🚚 شحن",
  };
  return map[t] ?? t;
}

// ── السائق: قائمة الطلبات القريبة ──────────────────────────────────────────────────
router.get("/rides/driver", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const status = req.query.status as string | undefined;

    const conditions = [eq(ridesTable.status, status || "pending")];
    if (status === "accepted") {
      // Return all active rides for this driver: accepted, arrived, picked_up
      conditions.length = 0;
      conditions.push(inArray(ridesTable.status, ["accepted", "arrived", "picked_up"]));
      conditions.push(eq(ridesTable.driverId, driverId));
    }

    const rows = (await db
      .select()
      .from(ridesTable)
      .where(and(...conditions))
      .orderBy(desc(ridesTable.createdAt))) ?? [];

    // fetch passenger info
    const passengerIds = [...new Set(rows.map((r) => r.passengerId))];
    const passengers = passengerIds.length > 0
      ? (await db.select({
          id: usersTable.id, name: usersTable.name, phone: usersTable.phone, avatar: usersTable.avatar,
        }).from(usersTable).where(inArray(usersTable.id, passengerIds))) ?? []
      : [];
    const pMap = Object.fromEntries(passengers.map((p) => [p.id, p]));

    // fetch driver vehicle info for active rides
    const driverIds = [...new Set(rows.map((r) => r.driverId).filter(Boolean))] as string[];
    const driverProfiles = driverIds.length > 0
      ? (await db.select({
          userId: driverProfilesTable.userId,
          vehicleType: driverProfilesTable.vehicleType,
          vehicleModel: driverProfilesTable.vehicleModel,
          vehiclePlate: driverProfilesTable.vehiclePlate,
          vehicleColor: driverProfilesTable.vehicleColor,
        }).from(driverProfilesTable).where(inArray(driverProfilesTable.userId, driverIds))) ?? []
      : [];
    const dProfMap = Object.fromEntries(driverProfiles.map((d) => [d.userId, d]));

    res.json(rows.map((r) => ({
      ...r,
      passenger: pMap[r.passengerId] ?? null,
      driverProfile: r.driverId ? (dProfMap[r.driverId] ?? null) : null,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── جلب تفاصيل رحلة واحدة ──────────────────────────────────────────────────
router.get("/rides/:id", authenticate, async (req, res): Promise<void> => {
  try {
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }

    // fetch passenger info
    const [passenger] = (await db.select({
      id: usersTable.id, name: usersTable.name, phone: usersTable.phone, avatar: usersTable.avatar,
    }).from(usersTable).where(eq(usersTable.id, ride.passengerId))) ?? [];

    // fetch driver info if assigned
    let driver = null;
    if (ride.driverId) {
      const [d] = (await db.select({
        id: usersTable.id, name: usersTable.name, phone: usersTable.phone, avatar: usersTable.avatar,
      }).from(usersTable).where(eq(usersTable.id, ride.driverId))) ?? [];
      driver = d ?? null;
    }

    // fetch driver vehicle info
    let driverProfile = null;
    if (ride.driverId) {
      const [dp] = (await db.select({
        vehicleType: driverProfilesTable.vehicleType,
        vehicleModel: driverProfilesTable.vehicleModel,
        vehiclePlate: driverProfilesTable.vehiclePlate,
        vehicleColor: driverProfilesTable.vehicleColor,
      }).from(driverProfilesTable).where(eq(driverProfilesTable.userId, ride.driverId))) ?? [];
      driverProfile = dp ?? null;
    }

    res.json({ ...ride, passenger: passenger ?? null, driver, driverProfile });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الراكب: رحلاتي ──────────────────────────────────────────────────
router.get("/rides/my", authenticate, async (req, res): Promise<void> => {
  try {
    const passengerId = (req as any).user.id;
    const rows = (await db
      .select()
      .from(ridesTable)
      .where(eq(ridesTable.passengerId, passengerId))
      .orderBy(desc(ridesTable.createdAt))) ?? [];

    const driverIds = [...new Set(rows.filter((r) => r.driverId).map((r) => r.driverId))].filter(Boolean) as string[];
    const drivers = driverIds.length > 0
      ? (await db.select({
          id: usersTable.id, name: usersTable.name, phone: usersTable.phone, avatar: usersTable.avatar,
        }).from(usersTable).where(inArray(usersTable.id, driverIds))) ?? []
      : [];
    const dMap = Object.fromEntries(drivers.map((d) => [d.id, d]));

    res.json(rows.map((r) => ({ ...r, driver: r.driverId ? (dMap[r.driverId] ?? null) : null })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: قبول الرحلة ──────────────────────────────────────────────────
router.patch("/rides/:id/accept", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;

    // تحقق من إشتراك/تجربة السائق
    const [profile] = (await db.select({
      trialExpiresAt: driverProfilesTable.trialExpiresAt,
      subscriptionExpiresAt: driverProfilesTable.subscriptionExpiresAt,
      isFree: driverProfilesTable.isFree,
      isSubscribed: driverProfilesTable.isSubscribed,
      vehicleType: driverProfilesTable.vehicleType,
      vehicleModel: driverProfilesTable.vehicleModel,
    }).from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];

    const now = new Date();
    const trialActive = profile?.trialExpiresAt && new Date(profile.trialExpiresAt) > now;
    const subscriptionActive = profile?.subscriptionExpiresAt && new Date(profile.subscriptionExpiresAt) > now;

    if (!profile?.isFree && !trialActive && !subscriptionActive) {
      res.status(403).json({ error: "يجب اشتراك لقبول الرحلات" });
      return;
    }

    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.status !== "pending") { res.status(409).json({ error: "الرحلة تم قبولها من سائق آخر", alreadyTaken: true }); return; }

    // تأكيد مرة ثانية للحالة = pending قبل التحديث (race condition fix)
    const now2 = new Date();
    await db.update(ridesTable).set({
      driverId, status: "accepted", acceptedAt: now2, updatedAt: now2,
    }).where(and(eq(ridesTable.id, req.params.id as string), eq(ridesTable.status, "pending")));

    // التحقق من التحديث الفعلي
    const [updatedRide] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (updatedRide?.status !== "accepted" || updatedRide?.driverId !== driverId) {
      res.status(409).json({ error: "الرحلة تم قبولها من سائق آخر", alreadyTaken: true });
      return;
    }

    // إشعار بقية السائقين: "الرحلة تم قبولها"
    const otherDrivers = (await db
      .select({ userId: driverProfilesTable.userId })
      .from(driverProfilesTable)
      .where(and(
        eq(driverProfilesTable.isOnline, true),
        eq(driverProfilesTable.isAvailable, true),
        sql`${driverProfilesTable.userId} != ${driverId}`,
      ))) ?? [];
    if (otherDrivers.length > 0) {
      await notifyUsers({
        userIds: otherDrivers.map((d) => d.userId),
        title: "رحلة محجوزة ✔️",
        body: "تم قبول الطلب من سائق آخر",
        data: { type: "ride_taken", rideId: ride.id },
      });
    }

    // إنشاء/إيجاد محادثة بين السائق والراكب
    let conversationId: string;
    const [existingConv] = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(eq(conversationsTable.participant1Id, driverId), eq(conversationsTable.participant2Id, ride.passengerId)),
          and(eq(conversationsTable.participant1Id, ride.passengerId), eq(conversationsTable.participant2Id, driverId))
        )
      );

    if (existingConv) {
      conversationId = existingConv.id;
      await db.update(conversationsTable).set({ updatedAt: now }).where(eq(conversationsTable.id, conversationId));
    } else {
      const convId = randomUUID();
      await db.insert(conversationsTable).values({
        id: convId,
        participant1Id: driverId,
        participant2Id: ride.passengerId,
        updatedAt: now,
      });
      conversationId = convId;
    }

    // أول رسالة تلقائية
    const firstMsg = `🚕 *تم قبول رحلتك!*\n📍 من: ${ride.fromAddress}\n📍 إلى: ${ride.toAddress}\n💰 السعر: ${ride.price} دج\n\nالسائق في الطريق إليك 🏎️`;
    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversationId,
      senderId: driverId,
      content: firstMsg,
    });

    // إشعار الراكب
    await notifyUsers({
      userIds: [ride.passengerId],
      title: "★ سائق مؤهل!",
      body: "سائق في الطريق إليك",
      data: { type: "ride_accepted", rideId: ride.id, conversationId, ...(profile?.vehicleModel ? { driverName: `${profile.vehicleModel} (${vTypeLabel(profile.vehicleType ?? 'car')})` } : {}) },
    });

    // بيانات الراكب للسائق
    const [passenger] = (await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, avatar: usersTable.avatar }).from(usersTable).where(eq(usersTable.id, ride.passengerId))) ?? [];

    res.json({ success: true, conversationId, passenger: passenger ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: وصول للموقع (قبل استلام الراكب) ─────────────────────────────
router.patch("/rides/:id/arrived", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.driverId !== driverId) { res.status(403).json({ error: "ليس رحلتك" }); return; }

    const now = new Date();
    await db.update(ridesTable).set({ status: "arrived", arrivedAt: now, updatedAt: now }).where(eq(ridesTable.id, req.params.id as string));

    await notifyUsers({
      userIds: [ride.passengerId],
      title: "📍 السائق وصل!",
      body: "السائق وصل للموقع. انتظر بالباب الأمامي.",
      data: { type: "ride_arrived", rideId: ride.id },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: استلام الراكب ──────────────────────────────────────────────────
router.patch("/rides/:id/pickup", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.driverId !== driverId) { res.status(403).json({ error: "ليس رحلتك" }); return; }

    const now = new Date();
    await db.update(ridesTable).set({
      status: "picked_up", pickedUpAt: now, updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    await notifyUsers({
      userIds: [ride.passengerId],
      title: "🚕 السائق استلمك!",
      body: "السائق وصل إليك واستلمك بالسيارة",
      data: { type: "ride_pickup", rideId: ride.id },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: تنفيذ الرحلة ──────────────────────────────────────────────────
router.patch("/rides/:id/complete", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }

    const now = new Date();
    await db.update(ridesTable).set({
      status: "completed", completedAt: now, updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    // تحديث إحصائيات السائق
    await db.update(driverProfilesTable).set({
      totalRides: sql`${driverProfilesTable.totalRides} + 1`,
      totalEarnings: sql`${driverProfilesTable.totalEarnings} + ${ride.price}`,
    }).where(eq(driverProfilesTable.userId, driverId));

    await notifyUsers({
      userIds: [ride.passengerId],
      title: "✅ وصلت!",
      body: "نرجوك تقييم الرحلة",
      data: { type: "ride_completed", rideId: ride.id },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الجميع: تقييم الرحلة ──────────────────────────────────────────────────
router.patch("/rides/:id/rate", authenticate, async (req, res): Promise<void> => {
  try {
    const { rating, review } = req.body;
    const userId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }

    const isPassenger = ride.passengerId === userId;
    const isDriver = ride.driverId === userId;

    if (isPassenger) {
      await db.update(ridesTable).set({ driverRating: rating, driverReview: review ?? null }).where(eq(ridesTable.id, req.params.id as string));
    } else if (isDriver) {
      await db.update(ridesTable).set({ passengerRating: rating, review: review ?? null }).where(eq(ridesTable.id, req.params.id as string));
    } else {
      res.status(403).json({ error: "ليس من صلاحياتك" });
      return;
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الراكب/السائق: إلغاء الرحلة ──────────────────────────────────────────────────
// ── الراكب: تغيير السعر لإعادة المحاولة ────────────────────
router.patch("/rides/:id/price", authenticate, async (req, res): Promise<void> => {
  try {
    const passengerId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.passengerId !== passengerId) { res.status(403).json({ error: "ليس من صلاحياتك" }); return; }
    if (ride.status !== "pending") { res.status(400).json({ error: "لا يمكن تغيير السعر بعد قبول سائق" }); return; }

    const { price } = req.body;
    const now = new Date();
    await db.update(ridesTable).set({
      price: String(price), updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    // إشعار السائقين المشتركين أو المجانيين أو في التجربة بالسعر الجديد
    const drivers = (await db
      .select({ userId: driverProfilesTable.userId })
      .from(driverProfilesTable)
      .where(and(
        eq(driverProfilesTable.isOnline, true),
        eq(driverProfilesTable.isAvailable, true),
        or(
          eq(driverProfilesTable.isFree, true),
          and(
            eq(driverProfilesTable.isSubscribed, true),
            sql`${driverProfilesTable.subscriptionExpiresAt} > ${now}`,
          ),
          sql`${driverProfilesTable.trialExpiresAt} > ${now}`,
        ),
      ))) ?? [];

    if (drivers.length > 0) {
      await notifyUsers({
        userIds: drivers.map((d) => d.userId),
        title: "طلب نقل بسعر جديد! 🚕",
        body: `${ride.fromAddress} → ${ride.toAddress} | ${price} دج`,
        data: { type: "price_update", rideId: ride.id },
      });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/rides/:id/cancel", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.status === "completed") { res.status(400).json({ error: "الرحلة منتهية" }); return; }

    const now = new Date();
    await db.update(ridesTable).set({
      status: "cancelled", cancelledBy: userId, cancelledAt: now, updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    const otherUserId = ride.passengerId === userId ? ride.driverId : ride.passengerId;
    if (otherUserId) {
      await notifyUsers({
        userIds: [otherUserId],
        title: "❌ تم الإلغاء",
        body: "تم إلغاء الرحلة",
        data: { type: "ride_cancelled", rideId: ride.id },
      });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: تحديث الموقع ──────────────────────────────────────────────────
router.patch("/driver/location", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const { lat, lng, isAvailable } = req.body;
    const now = new Date();

    // ✅ جميع السائقين مجانيون — لا حاجة لتحقق من الاشتراك
    const [profile] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];
    // دائماً يُسمح بالتفعيل للسائقين المجانيين
    if (isAvailable && !profile) {
      res.status(403).json({ error: "profile_missing", message: "يجب إكمال تسجيل السائق أولاً" });
      return;
    }

    await db.update(driverProfilesTable).set({
      currentLat: lat ?? null,
      currentLng: lng ?? null,
      isAvailable: isAvailable ?? true,
      isOnline: isAvailable ?? true,
      updatedAt: now,
    }).where(eq(driverProfilesTable.userId, driverId));

    res.json({ success: true, isSubscribed: !!profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: الملف الشخصي ──────────────────────────────────────────────────
router.get("/driver/profile", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [profile] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];
    if (!profile) {
      res.status(404).json({ error: "ليس لديك ملف سائق" });
      return;
    }
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: إنشاء/تحديث الملف ──────────────────────────────────────────────────
router.post("/driver/profile", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const { vehicleType, vehicleModel, vehiclePlate, vehicleColor, licenseImage, idCardImage, vehicleDocImage } = req.body;
    const now = new Date();

    const [existing] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];

    const isFirstSubmit = !existing?.documentsSubmittedAt;

    if (existing) {
      await db.update(driverProfilesTable).set({
        vehicleType: vehicleType ?? existing.vehicleType,
        vehicleModel: vehicleModel ?? existing.vehicleModel,
        vehiclePlate: vehiclePlate ?? existing.vehiclePlate,
        vehicleColor: vehicleColor ?? existing.vehicleColor,
        licenseImage: licenseImage ?? existing.licenseImage,
        idCardImage: idCardImage ?? existing.idCardImage,
        vehicleDocImage: vehicleDocImage ?? existing.vehicleDocImage,
        documentsSubmittedAt: (licenseImage || idCardImage || vehicleDocImage) ? now : existing.documentsSubmittedAt,
        documentsStatus: isFirstSubmit ? "pending" : existing.documentsStatus,
        updatedAt: now,
      }).where(eq(driverProfilesTable.userId, driverId));
    } else {
      const trialExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days trial
      await db.insert(driverProfilesTable).values({
        id: randomUUID(),
        userId: driverId,
        vehicleType: vehicleType ?? null,
        vehicleModel: vehicleModel ?? null,
        vehiclePlate: vehiclePlate ?? null,
        vehicleColor: vehicleColor ?? null,
        licenseImage: licenseImage ?? null,
        idCardImage: idCardImage ?? null,
        vehicleDocImage: vehicleDocImage ?? null,
        trialExpiresAt: trialExpiry,
        documentsSubmittedAt: (licenseImage || idCardImage || vehicleDocImage) ? now : null,
        documentsStatus: (licenseImage || idCardImage || vehicleDocImage) ? "pending" : null,
        createdAt: now,
        updatedAt: now,
      });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: حالة الوثائق ──────────────────────────────────────────────────
router.get("/driver/documents-status", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [profile] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];
    if (!profile) {
      res.json({ status: "not_submitted", documents: null });
      return;
    }
    res.json({
      status: profile.documentsStatus ?? "not_submitted",
      licenseVerified: profile.licenseVerified,
      documentsSubmittedAt: profile.documentsSubmittedAt,
      documents: {
        licenseImage: !!profile.licenseImage,
        idCardImage: !!profile.idCardImage,
        vehicleDocImage: !!profile.vehicleDocImage,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: الاشتراك الشهري ──────────────────────────────────────────────────
router.get("/driver/subscription", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [profile] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];
    const now = new Date();
    const trialActive = profile?.trialExpiresAt && new Date(profile.trialExpiresAt) > now;
    const subscriptionActive = profile?.subscriptionExpiresAt && new Date(profile.subscriptionExpiresAt) > now;
    const isActive = profile?.isFree || trialActive || subscriptionActive;
    const isFree = profile?.isFree || trialActive;

    // Check for pending driver subscription requests
    const [pendingSub] = (await db
      .select()
      .from(subscriptionsTable)
      .where(and(
        eq(subscriptionsTable.userId, driverId),
        eq(subscriptionsTable.type, "driver")
      ))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1)) ?? [];
    const isPending = pendingSub?.status === "pending";

    res.json({
      isSubscribed: isActive,
      isFree: isFree,
      expiresAt: profile?.subscriptionExpiresAt ?? null,
      trialExpiresAt: profile?.trialExpiresAt ?? null,
      isPending: false,
      plan: "driver_monthly",
      hasProfile: !!profile?.documentsSubmittedAt,
      documentsStatus: profile?.documentsStatus ?? "not_submitted",
      licenseVerified: profile?.licenseVerified ?? false,
      latestRequest: pendingSub ?? null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: تفعيل اشتراك السائق ──────────────────────────────────────────────────
router.patch("/admin/driver-subscriptions/:userId/approve", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const [existing] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId))) ?? [];
    if (!existing) {
      await db.insert(driverProfilesTable).values({
        id: randomUUID(),
        userId,
        isSubscribed: true,
        subscriptionExpiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db.update(driverProfilesTable)
        .set({ isSubscribed: true, subscriptionExpiresAt: expiresAt, updatedAt: now })
        .where(eq(driverProfilesTable.userId, userId));
    }

    res.json({ success: true, expiresAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
