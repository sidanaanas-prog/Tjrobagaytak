// هذا الملف للتوافقية فقط — Capacitor يعمل في التطبيق Native فقط، ليس في الويب
// الدوال هنا stubs فارغة على الويب

export async function initNativeNotifications(): Promise<void> {
  return;
}

export async function triggerNativeRideCall(_ride: {
  id: string;
  fromAddress: string;
  toAddress: string;
  price: string;
}): Promise<void> {
  return;
}

export async function clearNativeRideCall(_rideId: string): Promise<void> {
  return;
}
