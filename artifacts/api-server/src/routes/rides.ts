import { Router, type IRouter } from "express";
import { db, ridesTable, driverProfilesTable, userRolesTable, usersTable, subscriptionsTable, conversationsTable, messagesTable, walletsTable, walletTransactionsTable, destinationsTable, rideSettingsTable, competitionParticipantsTable } from "@workspace/db";
import { eq, desc, and, or, isNull, sql, inArray, gt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, optionalAuthenticate, requireAdmin } from "../lib/auth";
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
    const completionCode = String(Math.floor(1000 + Math.random() * 9000)); // كود تأكيد عشوائي من 4 أرقام

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
      completionCode, // حفظ كود التأكيد
      createdAt: now,
      updatedAt: now,
    });

    // إشعار جميع السائقين المسجلين بنفس نوع السيارة (حتى لو كانوا بالخلفية أو غير نشطين حالياً لضمان وصول الإشعار)
    const typeFilter = vType === "car" ? undefined : eq(driverProfilesTable.vehicleType, vType);
    const conditions = [];
    if (typeFilter) conditions.push(typeFilter);

    const drivers = (await db
      .select({ userId: driverProfilesTable.userId, vehicleType: driverProfilesTable.vehicleType })
      .from(driverProfilesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)) ?? [];

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

    // Fetch settings for commission calculations
    const [typeSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_type"));
    const [valSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_value"));
    const [rateSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_rate"));

    const commType = typeSetting?.value || "percentage";
    const commVal = Number(valSetting?.value || rateSetting?.value || "10");

    res.json(rows.map((r) => {
      const priceNum = Number(r.price || 0);
      let commission = 0;
      if (commType === "fixed") {
        commission = commVal;
      } else {
        commission = Math.round(priceNum * (commVal / 100));
      }
      const netProfit = Math.max(0, priceNum - commission);

      return {
        ...r,
        commission,
        netProfit,
        passenger: pMap[r.passengerId] ?? null,
        driverProfile: r.driverId ? (dProfMap[r.driverId] ?? null) : null,
      };
    }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الراكب: رحلاتي — يجب أن يكون قبل /rides/:id لأن Express يُطابق بالترتيب
router.get("/rides/my", authenticate, async (req, res): Promise<void> => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
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

    // Fetch settings for commission calculations
    const [typeSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_type"));
    const [valSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_value"));
    const [rateSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_rate"));

    const commType = typeSetting?.value || "percentage";
    const commVal = Number(valSetting?.value || rateSetting?.value || "10");

    res.json(rows.map((r) => {
      const priceNum = Number(r.price || 0);
      let commission = 0;
      if (commType === "fixed") {
        commission = commVal;
      } else {
        commission = Math.round(priceNum * (commVal / 100));
      }
      const netProfit = Math.max(0, priceNum - commission);

      return {
        ...r,
        commission,
        netProfit,
        driver: r.driverId ? (dMap[r.driverId] ?? null) : null
      };
    }));
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

// ── السائق: قبول الرحلة ──────────────────────────────────────────────────
router.patch("/rides/:id/accept", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;

    // تحقق من تسجيل وتوثيق السائق
    const [profile] = (await db.select({
      documentsStatus: driverProfilesTable.documentsStatus,
      vehicleType: driverProfilesTable.vehicleType,
      vehicleModel: driverProfilesTable.vehicleModel,
    }).from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];

    if (!profile) {
      res.status(403).json({ error: "يجب إكمال تسجيل السائق أولاً" });
      return;
    }

    if (profile.documentsStatus !== "verified") {
      res.status(403).json({ error: "يجب تأكيد وثائق السائق من الإدارة أولاً لقبول الرحلات" });
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
    const firstMsg = `🚕 *تم قبول رحلتك!*\n📍 من: ${ride.fromAddress}\n📍 إلى: ${ride.toAddress}\n💰 السعر: ${ride.price} ألف دورو\n\nالسائق في الطريق إليك 🏎️`;
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
    const { code } = req.body;

    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.driverId !== driverId) { res.status(403).json({ error: "ليس من صلاحياتك إنهاء هذه الرحلة" }); return; }
    if (ride.status === "completed") { res.json({ success: true, message: "الرحلة منتهية بالفعل" }); return; }

    // التحقق من رمز التأكيد لتفادي تحايل السائقين
    if (!code) {
      res.status(400).json({ error: "الرجاء إدخال رمز التأكيد المتكون من 4 أرقام المستلم من الراكب لإنهاء الرحلة" });
      return;
    }
    if (ride.completionCode && ride.completionCode.trim() !== String(code).trim()) {
      res.status(400).json({ error: "رمز التأكيد المدخل غير صحيح! الرجاء التأكد من الراكب." });
      return;
    }

    const now = new Date();

    // 1. حساب وإضافة نقاط الوفاء للراكب لتشجيعه على إعطاء الرمز للسائق
    const ridePrice = Number(ride.price || 0);
    const pointsEarned = Math.max(1, Math.round(ridePrice / 10)); // نقطة واحدة لكل 10 ألف دورو
    await db.update(usersTable)
      .set({ points: sql`${usersTable.points} + ${pointsEarned}` })
      .where(eq(usersTable.id, ride.passengerId));

    // 2. تحديث حالة الرحلة إلى منتهية
    await db.update(ridesTable).set({
      status: "completed", completedAt: now, updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    // 3. جلب ملف السائق لمعالجة الرحلات المجانية الخمس والعمولة
    const [driverProfile] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, driverId))) ?? [];
    const freeRidesCount = driverProfile?.freeRidesLeft ?? 0;

    let commissionDeducted = 0;

    if (freeRidesCount > 0) {
      // السائق لا يزال في فترة الرحلات الخمس المجانية
      await db.update(driverProfilesTable).set({
        freeRidesLeft: sql`${driverProfilesTable.freeRidesLeft} - 1`,
        totalRides: sql`${driverProfilesTable.totalRides} + 1`,
        totalEarnings: sql`${driverProfilesTable.totalEarnings} + ${ride.price}`,
      }).where(eq(driverProfilesTable.userId, driverId));
    } else {
      // السائق أكمل رحلاته المجانية ويجب خصم عمولة مخصصة من لوحة التحكم (الافتراضية 10%)
      const [typeSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_type"));
      const [valSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_value"));
      const [rateSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "commission_rate"));

      const commType = typeSetting?.value || "percentage";
      const commVal = Number(valSetting?.value || rateSetting?.value || "10");

      if (commType === "fixed") {
        commissionDeducted = commVal;
      } else {
        commissionDeducted = Math.round(ridePrice * (commVal / 100));
      }

      // خصم من محفظة السائق وتسجيل المعاملة
      const [driverWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, driverId));
      let walletId = driverWallet?.id;
      let currentBalance = Number(driverWallet?.balance ?? 0);

      if (!driverWallet) {
        walletId = randomUUID();
        await db.insert(walletsTable).values({
          id: walletId,
          userId: driverId,
          balance: "0",
        });
        currentBalance = 0;
      } else {
        walletId = driverWallet.id;
      }

      const newBalance = currentBalance - commissionDeducted;
      await db.update(walletsTable).set({
        balance: String(newBalance),
        updatedAt: now,
      }).where(eq(walletsTable.id, walletId!));

      // تسجيل المعاملة المالية في الأرشيف
      await db.insert(walletTransactionsTable).values({
        id: randomUUID(),
        walletId: walletId!,
        userId: driverId,
        type: "penalty", // عمولة تطبيق
        amount: String(-commissionDeducted),
        balanceAfter: String(newBalance),
        description: commType === "fixed" 
          ? `عمولة الكورسة (مبلغ ثابت: ${commVal} ألف دورو) من ${ride.fromAddress} إلى ${ride.toAddress}`
          : `عمولة الكورسة (${commVal}%) من ${ride.fromAddress} إلى ${ride.toAddress}`,
        rideId: ride.id,
        status: "completed",
      });

      // تحديث إحصائيات السائق العامة
      await db.update(driverProfilesTable).set({
        totalRides: sql`${driverProfilesTable.totalRides} + 1`,
        totalEarnings: sql`${driverProfilesTable.totalEarnings} + ${ride.price}`,
      }).where(eq(driverProfilesTable.userId, driverId));
    }

    // 1.5. التحقق من الإحالة لإضافة نقاط في المسابقة
    try {
      const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, ride.passengerId));
      if (passenger?.referredBy) {
        // التحقق من تفعيل المسابقة وحالتها
        const [enabledSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "competition_enabled"));
        const [statusSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "competition_status"));
        
        if (enabledSetting?.value === "true" && statusSetting?.value === "open") {
          const [participant] = await db.select().from(competitionParticipantsTable).where(eq(competitionParticipantsTable.userId, passenger.referredBy));
          if (participant) {
            await db.update(competitionParticipantsTable)
              .set({ points: sql`${competitionParticipantsTable.points} + 1` })
              .where(eq(competitionParticipantsTable.userId, passenger.referredBy));
            console.log(`Competition Point Awarded: User ${passenger.referredBy} invited passenger ${ride.passengerId} who completed ride ${ride.id}`);
          }
        }
      }
    } catch (err) {
      console.error("Error updating competition points on ride completion:", err);
    }

    await notifyUsers({
      userIds: [ride.passengerId],
      title: "✅ وصلت بالسلامة!",
      body: `لقد حصلت على ${pointsEarned} نقطة وفاء مجانية! نرجو منك تقييم الرحلة.`,
      data: { type: "ride_completed", rideId: ride.id, pointsEarned },
    });

    res.json({
      success: true,
      pointsEarned,
      freeRidesLeft: Math.max(0, freeRidesCount - 1),
      commissionDeducted
    });
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

    // إشعار جميع السائقين المسجلين بنفس نوع السيارة بالسعر الجديد (حتى لو كانوا بالخلفية أو غير نشطين حالياً لضمان وصول الإشعار)
    const vType = ride.vehicleType ?? "car";
    const typeFilter = vType === "car" ? undefined : eq(driverProfilesTable.vehicleType, vType);
    const conditions = [];
    if (typeFilter) conditions.push(typeFilter);

    const drivers = (await db
      .select({ userId: driverProfilesTable.userId })
      .from(driverProfilesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)) ?? [];

    if (drivers.length > 0) {
      await notifyUsers({
        userIds: drivers.map((d) => d.userId),
        title: "طلب نقل بسعر جديد! 🚕",
        body: `${ride.fromAddress} → ${ride.toAddress} | ${price} ألف دورو`,
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

    // جلب أو إنشاء رصيد المحفظة
    let walletBalance = "0";
    const [wallet] = (await db.select().from(walletsTable).where(eq(walletsTable.userId, driverId))) ?? [];
    if (wallet) {
      walletBalance = wallet.balance;
    } else {
      const walletId = randomUUID();
      try {
        await db.insert(walletsTable).values({
          id: walletId,
          userId: driverId,
          balance: "0",
          currency: "DZD",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (e) {
        // Safe fallback if another request inserts it concurrently
      }
    }

    res.json({
      ...profile,
      walletBalance,
    });
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
    const hasDocsNow = !!(licenseImage || idCardImage || vehicleDocImage);
    let documentsStatus = existing ? existing.documentsStatus : null;

    if (hasDocsNow) {
      if (isFirstSubmit || !existing || existing.documentsStatus === "rejected" || !existing.documentsStatus) {
        documentsStatus = "pending";
      }
    }

    if (existing) {
      await db.update(driverProfilesTable).set({
        vehicleType: vehicleType ?? existing.vehicleType,
        vehicleModel: vehicleModel ?? existing.vehicleModel,
        vehiclePlate: vehiclePlate ?? existing.vehiclePlate,
        vehicleColor: vehicleColor ?? existing.vehicleColor,
        licenseImage: licenseImage ?? existing.licenseImage,
        idCardImage: idCardImage ?? existing.idCardImage,
        vehicleDocImage: vehicleDocImage ?? existing.vehicleDocImage,
        documentsSubmittedAt: hasDocsNow ? now : existing.documentsSubmittedAt,
        documentsStatus,
        trialExpiresAt: null, // No more 7 days free trial
        updatedAt: now,
      }).where(eq(driverProfilesTable.userId, driverId));
    } else {
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
        trialExpiresAt: null, // No more 7 days free trial
        freeRidesLeft: 0, // Starts with 0 free rides until verified by admin
        documentsSubmittedAt: hasDocsNow ? now : null,
        documentsStatus: hasDocsNow ? "pending" : null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // إرسال إشعار للأدمن عند رفع الوثائق
    if (hasDocsNow && documentsStatus === "pending") {
      try {
        const [admin] = (await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, "admin@gaytak.com"))) ?? [];
        if (admin?.id) {
          const [driverUser] = (await db.select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, driverId))) ?? [];
          await notifyUsers({
            userIds: [admin.id],
            title: "📄 وثائق سائق جديدة قيد المراجعة",
            body: `قام السائق "${driverUser?.name || 'مجهول'}" برفع وثائقه للمراجعة والتوثيق.`,
            data: { type: "driver_docs_pending", driverId },
          });
        }
      } catch (err) {
        console.error("Error notifying admin:", err);
      }
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

    const isSubscribed = profile?.documentsStatus === "verified";
    const isFree = profile?.documentsStatus === "verified" && (profile?.isFree || (profile?.freeRidesLeft ?? 0) > 0);
    const isPending = profile?.documentsStatus === "pending";

    res.json({
      isSubscribed: isSubscribed,
      isFree: isFree,
      expiresAt: profile?.subscriptionExpiresAt ?? null,
      trialExpiresAt: null,
      isPending: isPending,
      plan: "driver_monthly",
      hasProfile: !!profile?.documentsSubmittedAt,
      documentsStatus: profile?.documentsStatus ?? "not_submitted",
      licenseVerified: profile?.licenseVerified ?? false,
      latestRequest: null,
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

// ── السائق: تبليغ "الراكب لم يأتِ" ──────────────────────────────────────
router.patch("/rides/:id/no-show", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.driverId !== driverId) { res.status(403).json({ error: "ليس رحلتك" }); return; }
    if (!["accepted", "arrived", "picked_up"].includes(ride.status)) { res.status(400).json({ error: "لا يمكن تبليغ لم يأتِ الآن — الرحلة يجب أن تكون مقبولة" }); return; }

    const now = new Date();
    await db.update(ridesTable).set({
      riderNoShow: true, riderNoShowAt: now, status: "cancelled",
      cancelledBy: driverId, cancelledAt: now, cancelReason: "rider_no_show", updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    // عقوبة: زيادة عداد no-show للراكب
    const [passenger] = (await db.select({ noShowCount: usersTable.noShowCount }).from(usersTable).where(eq(usersTable.id, ride.passengerId))) ?? [];
    const newCount = (passenger?.noShowCount ?? 0) + 1;
    await db.update(usersTable).set({
      noShowCount: newCount, noShowLastAt: now,
      rideBannedUntil: newCount >= 3 ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null,
    }).where(eq(usersTable.id, ride.passengerId));

    await notifyUsers({
      userIds: [ride.passengerId],
      title: "⚠️ تبليغ: لم تأتِ",
      body: `السائق بلغ أنك لم تأتِ. عدد تبليغاتك: ${newCount}. بعد 3 مرات = حظر 24س`,
      data: { type: "rider_no_show", rideId: ride.id, noShowCount: newCount },
    });

    res.json({ success: true, noShowCount: newCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: إلغاء بدون خسارة (إذا الراكب لم يأتِ) ──────────────────────────
router.patch("/rides/:id/cancel-safe", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.driverId !== driverId) { res.status(403).json({ error: "ليس رحلتك" }); return; }
    if (ride.status === "completed" || ride.status === "picked_up") { res.status(400).json({ error: "الرحلة في تقدم مبكر" }); return; }

    const now = new Date();
    const isNoShow = ride.riderNoShow;
    await db.update(ridesTable).set({
      status: "cancelled", cancelledBy: driverId, cancelledAt: now,
      cancelReason: isNoShow ? "rider_no_show_driver_cancel" : "driver_cancel", updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    await notifyUsers({
      userIds: [ride.passengerId],
      title: "❌ تم إلغاء الرحلة",
      body: isNoShow ? "السائق ألغاها لأنك لم تأتِ" : "السائق ألغاها",
      data: { type: "ride_cancelled", rideId: ride.id },
    });

    res.json({ success: true, noShow: isNoShow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── السائق: تحديث موقعه على الرحلة المباشرة ──────────────────────────────
router.patch("/rides/:id/location", authenticate, async (req, res): Promise<void> => {
  try {
    const driverId = (req as any).user.id;
    const { lat, lng } = req.body;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.driverId !== driverId) { res.status(403).json({ error: "ليس رحلتك" }); return; }

    const now = new Date();
    await db.update(ridesTable).set({
      driverLat: lat ?? null, driverLng: lng ?? null,
      driverLocationUpdatedAt: now, updatedAt: now,
    }).where(eq(ridesTable.id, req.params.id as string));

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تقدير السعر التلقائي ──────────────────────────────────────────────────
router.post("/rides/estimate", authenticate, async (req, res): Promise<void> => {
  try {
    const { fromLat, fromLng, toLat, toLng, vehicleType } = req.body;
    if (!fromLat || !fromLng || !toLat || !toLng) { res.status(400).json({ error: "إحداثيات GPS مطلوبة" }); return; }

    // Haversine formula — حساب المسافة بين نقطتين
    const R = 6371; // نسف الأرض بالكم
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(Number(toLat) - Number(fromLat));
    const dLng = toRad(Number(toLng) - Number(fromLng));
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(Number(fromLat))) * Math.cos(toRad(Number(toLat))) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // سعر الكيلومتر حسب نوع السيارة (بالدينار الجزايري)
    const basePrices: Record<string, number> = { car: 50, ac: 80, suv: 100, van: 120, truck: 150 };
    const perKm: Record<string, number> = { car: 25, ac: 35, suv: 40, van: 45, truck: 60 };
    const vtype = vehicleType && basePrices[vehicleType] ? vehicleType : "car";
    const estimatedPrice = Math.round(basePrices[vtype] + distance * perKm[vtype]);

    // الوقت التقريبي (دقيقة بكم)
    const avgSpeedKmH = vtype === "truck" ? 30 : 40;
    const estimatedMinutes = Math.round((distance / avgSpeedKmH) * 60);

    res.json({
      distance: Math.round(distance * 10) / 10,
      estimatedPrice,
      estimatedMinutes,
      currency: "DZD",
      vehicleType: vtype,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الراكب: تفاصيل الرحلة مع موقع السائق ──────────────────────────────────
router.get("/rides/:id/live", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [ride] = (await db.select().from(ridesTable).where(eq(ridesTable.id, req.params.id as string))) ?? [];
    if (!ride) { res.status(404).json({ error: "الرحلة غير موجودة" }); return; }
    if (ride.passengerId !== userId && ride.driverId !== userId) { res.status(403).json({ error: "ليس من صلاحياتك" }); return; }

    res.json({
      id: ride.id,
      status: ride.status,
      driverLat: ride.driverLat,
      driverLng: ride.driverLng,
      driverLocationUpdatedAt: ride.driverLocationUpdatedAt,
      fromLat: ride.fromLat, fromLng: ride.fromLng,
      toLat: ride.toLat, toLng: ride.toLng,
      fromAddress: ride.fromAddress, toAddress: ride.toAddress,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── جلب كل الوجهات المتاحة للراكب والسائق ──────────────────────────
router.get("/rides/destinations", authenticate, async (_req, res): Promise<void> => {
  try {
    const list = await db.select().from(destinationsTable).orderBy(desc(destinationsTable.createdAt));
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── جلب الإعدادات المتاحة للراكب والسائق (مثل عمولة التطبيق وطريقة التسعير) ──
router.get("/rides/settings", authenticate, async (_req, res): Promise<void> => {
  try {
    const list = await db.select().from(rideSettingsTable);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── المسابقات: جلب حالة المسابقة الحالية ولوحة الصدارة ────────────────────
router.get("/competition/status", optionalAuthenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    // جلب الإعدادات الخاصة بالمسابقة
    const settings = await db.select().from(rideSettingsTable);
    const getSetting = (key: string, def: string) => settings.find(s => s.key === key)?.value || def;

    const enabled = getSetting("competition_enabled", "false") === "true";
    const status = getSetting("competition_status", "preparing");
    const prize = getSetting("competition_prize", "50 ألف دورو");
    const terms = getSetting("competition_terms", "شروط المسابقة:\n١. قم بدعوة الركاب لتحميل التطبيق.\n٢. يحصل المشترك على نقطة عند إتمام المدعو لأول رحلة.\n٣. صاحب أكبر عدد نقاط يفوز بالجائزة.");
    const endTime = getSetting("competition_end_time", "");
    const winnerId = getSetting("competition_winner_id", "");

    // جلب جميع المشتركين وترتيبهم حسب النقاط تنازلياً
    const participantsList = await db.select().from(competitionParticipantsTable);
    
    // جلب بيانات المستخدمين المشتركين
    const userIds = participantsList.map(p => p.userId);
    const users = userIds.length > 0 
      ? await db.select({
          id: usersTable.id,
          name: usersTable.name,
          avatar: usersTable.avatar,
        }).from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const leaderboard = participantsList.map(p => {
      const u = userMap[p.userId];
      return {
        userId: p.userId,
        name: u?.name || "مستخدم مجهول",
        avatar: u?.avatar || null,
        inviteCode: p.inviteCode,
        points: p.points,
        joinedAt: p.joinedAt.toISOString(),
      };
    }).sort((a, b) => b.points - a.points);

    // حساب المراكز (ranks)
    const rankedLeaderboard = leaderboard.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    const userParticipant = rankedLeaderboard.find(p => p.userId === userId) || null;

    let winnerProfile = null;
    if (winnerId) {
      const wPart = rankedLeaderboard.find(p => p.userId === winnerId);
      if (wPart) {
        winnerProfile = wPart;
      } else {
        const [wUser] = await db.select({
          id: usersTable.id,
          name: usersTable.name,
          avatar: usersTable.avatar,
        }).from(usersTable).where(eq(usersTable.id, winnerId));
        if (wUser) {
          winnerProfile = {
            userId: wUser.id,
            name: wUser.name,
            avatar: wUser.avatar,
            points: 0,
            inviteCode: "—",
            rank: 1,
          };
        }
      }
    }

    res.json({
      enabled,
      status,
      prize,
      terms,
      endTime,
      winnerId: winnerId || null,
      winnerProfile,
      leaderboard: rankedLeaderboard,
      userParticipant,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── المسابقات: الاشتراك في المسابقة ─────────────────────────────────────
router.post("/competition/join", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const [enabledSetting] = await db.select().from(rideSettingsTable).where(eq(rideSettingsTable.key, "competition_enabled"));
    if (!enabledSetting || enabledSetting.value !== "true") {
      res.status(400).json({ error: "المسابقات غير مفعلة حالياً" });
      return;
    }

    const [existing] = await db.select().from(competitionParticipantsTable).where(eq(competitionParticipantsTable.userId, userId));
    if (existing) {
      res.json({ success: true, message: "أنت مشترك بالفعل في المسابقة", participant: existing });
      return;
    }

    // جلب بيانات المشترك لإنشاء كود إحالة مميز
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    // توليد كود إحالة فريد وسهل
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const inviteCode = `GT-${randomSuffix}`;

    await db.insert(competitionParticipantsTable).values({
      userId,
      inviteCode,
      points: 0,
    });

    res.status(201).json({
      success: true,
      message: "تم الاشتراك في المسابقة بنجاح! 🎉",
      inviteCode,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
