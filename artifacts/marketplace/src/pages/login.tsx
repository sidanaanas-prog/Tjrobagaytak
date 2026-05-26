import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ChevronDown, ChevronRight, Shield } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

type Step = "phone" | "otp";

const COUNTRIES = [
  // ── الوطن العربي ──
  { code: "+213", flag: "🇩🇿", name: "الجزائر" },
  { code: "+966", flag: "🇸🇦", name: "السعودية" },
  { code: "+971", flag: "🇦🇪", name: "الإمارات" },
  { code: "+974", flag: "🇶🇦", name: "قطر" },
  { code: "+965", flag: "🇰🇼", name: "الكويت" },
  { code: "+973", flag: "🇧🇭", name: "البحرين" },
  { code: "+968", flag: "🇴🇲", name: "عُمان" },
  { code: "+962", flag: "🇯🇴", name: "الأردن" },
  { code: "+961", flag: "🇱🇧", name: "لبنان" },
  { code: "+963", flag: "🇸🇾", name: "سوريا" },
  { code: "+964", flag: "🇮🇶", name: "العراق" },
  { code: "+20",  flag: "🇪🇬", name: "مصر" },
  { code: "+212", flag: "🇲🇦", name: "المغرب" },
  { code: "+216", flag: "🇹🇳", name: "تونس" },
  { code: "+218", flag: "🇱🇾", name: "ليبيا" },
  { code: "+249", flag: "🇸🇩", name: "السودان" },
  { code: "+967", flag: "🇾🇪", name: "اليمن" },
  { code: "+970", flag: "🇵🇸", name: "فلسطين" },
  { code: "+222", flag: "🇲🇷", name: "موريتانيا" },
  { code: "+253", flag: "🇩🇯", name: "جيبوتي" },
  { code: "+252", flag: "🇸🇴", name: "الصومال" },
  { code: "+269", flag: "🇰🇲", name: "جزر القمر" },
  // ── أوروبا ──
  { code: "+34",  flag: "🇪🇸", name: "إسبانيا" },
  { code: "+33",  flag: "🇫🇷", name: "فرنسا" },
  { code: "+49",  flag: "🇩🇪", name: "ألمانيا" },
  { code: "+44",  flag: "🇬🇧", name: "المملكة المتحدة" },
  { code: "+39",  flag: "🇮🇹", name: "إيطاليا" },
  { code: "+31",  flag: "🇳🇱", name: "هولندا" },
  { code: "+32",  flag: "🇧🇪", name: "بلجيكا" },
  { code: "+41",  flag: "🇨🇭", name: "سويسرا" },
  { code: "+43",  flag: "🇦🇹", name: "النمسا" },
  { code: "+46",  flag: "🇸🇪", name: "السويد" },
  { code: "+47",  flag: "🇳🇴", name: "النرويج" },
  { code: "+45",  flag: "🇩🇰", name: "الدانمارك" },
  { code: "+358", flag: "🇫🇮", name: "فنلندا" },
  { code: "+48",  flag: "🇵🇱", name: "بولندا" },
  { code: "+351", flag: "🇵🇹", name: "البرتغال" },
  { code: "+30",  flag: "🇬🇷", name: "اليونان" },
  { code: "+420", flag: "🇨🇿", name: "التشيك" },
  { code: "+36",  flag: "🇭🇺", name: "المجر" },
  { code: "+40",  flag: "🇷🇴", name: "رومانيا" },
  { code: "+380", flag: "🇺🇦", name: "أوكرانيا" },
  { code: "+7",   flag: "🇷🇺", name: "روسيا" },
  { code: "+90",  flag: "🇹🇷", name: "تركيا" },
  { code: "+353", flag: "🇮🇪", name: "أيرلندا" },
  { code: "+386", flag: "🇸🇮", name: "سلوفينيا" },
  { code: "+385", flag: "🇭🇷", name: "كرواتيا" },
  { code: "+381", flag: "🇷🇸", name: "صربيا" },
  { code: "+359", flag: "🇧🇬", name: "بلغاريا" },
  { code: "+372", flag: "🇪🇪", name: "إستونيا" },
  { code: "+371", flag: "🇱🇻", name: "لاتفيا" },
  { code: "+370", flag: "🇱🇹", name: "ليتوانيا" },
  { code: "+374", flag: "🇦🇲", name: "أرمينيا" },
  { code: "+995", flag: "🇬🇪", name: "جورجيا" },
  { code: "+994", flag: "🇦🇿", name: "أذربيجان" },
  { code: "+375", flag: "🇧🇾", name: "بيلاروس" },
  // ── أمريكا الشمالية ──
  { code: "+1",   flag: "🇺🇸", name: "الولايات المتحدة" },
  { code: "+1",   flag: "🇨🇦", name: "كندا" },
  { code: "+52",  flag: "🇲🇽", name: "المكسيك" },
  // ── أمريكا الجنوبية ──
  { code: "+55",  flag: "🇧🇷", name: "البرازيل" },
  { code: "+54",  flag: "🇦🇷", name: "الأرجنتين" },
  { code: "+56",  flag: "🇨🇱", name: "تشيلي" },
  { code: "+57",  flag: "🇨🇴", name: "كولومبيا" },
  { code: "+51",  flag: "🇵🇪", name: "بيرو" },
  { code: "+58",  flag: "🇻🇪", name: "فنزويلا" },
  { code: "+598", flag: "🇺🇾", name: "أوروغواي" },
  { code: "+593", flag: "🇪🇨", name: "الإكوادور" },
  { code: "+591", flag: "🇧🇴", name: "بوليفيا" },
  { code: "+595", flag: "🇵🇾", name: "باراغواي" },
  // ── آسيا ──
  { code: "+86",  flag: "🇨🇳", name: "الصين" },
  { code: "+91",  flag: "🇮🇳", name: "الهند" },
  { code: "+81",  flag: "🇯🇵", name: "اليابان" },
  { code: "+82",  flag: "🇰🇷", name: "كوريا الجنوبية" },
  { code: "+84",  flag: "🇻🇳", name: "فيتنام" },
  { code: "+62",  flag: "🇮🇩", name: "إندونيسيا" },
  { code: "+60",  flag: "🇲🇾", name: "ماليزيا" },
  { code: "+65",  flag: "🇸🇬", name: "سنغافورة" },
  { code: "+66",  flag: "🇹🇭", name: "تايلاند" },
  { code: "+63",  flag: "🇵🇭", name: "الفلبين" },
  { code: "+92",  flag: "🇵🇰", name: "باكستان" },
  { code: "+880", flag: "🇧🇩", name: "بنغلاديش" },
  { code: "+94",  flag: "🇱🇰", name: "سريلانكا" },
  { code: "+95",  flag: "🇲🇲", name: "ميانمار" },
  { code: "+98",  flag: "🇮🇷", name: "إيران" },
  { code: "+972", flag: "🇮🇱", name: "إسرائيل" },
  { code: "+93",  flag: "🇦🇫", name: "أفغانستان" },
  { code: "+976", flag: "🇲🇳", name: "منغوليا" },
  { code: "+855", flag: "🇰🇭", name: "كمبوديا" },
  { code: "+856", flag: "🇱🇦", name: "لاوس" },
  { code: "+977", flag: "🇳🇵", name: "نيبال" },
  // ── أفريقيا ──
  { code: "+234", flag: "🇳🇬", name: "نيجيريا" },
  { code: "+27",  flag: "🇿🇦", name: "جنوب أفريقيا" },
  { code: "+254", flag: "🇰🇪", name: "كينيا" },
  { code: "+256", flag: "🇺🇬", name: "أوغندا" },
  { code: "+255", flag: "🇹🇿", name: "تنزانيا" },
  { code: "+251", flag: "🇪🇹", name: "إثيوبيا" },
  { code: "+233", flag: "🇬🇭", name: "غانا" },
  { code: "+243", flag: "🇨🇩", name: "الكونغو الديمقراطية" },
  { code: "+225", flag: "🇨🇮", name: "ساحل العاج" },
  { code: "+221", flag: "🇸🇳", name: "السنغال" },
  { code: "+223", flag: "🇲🇱", name: "مالي" },
  { code: "+257", flag: "🇧🇮", name: "بوروندي" },
  { code: "+250", flag: "🇷🇼", name: "رواندا" },
  { code: "+260", flag: "🇿🇲", name: "زامبيا" },
  { code: "+263", flag: "🇿🇼", name: "زيمبابوي" },
  { code: "+267", flag: "🇧🇼", name: "بوتسوانا" },
  { code: "+265", flag: "🇲🇼", name: "مالاوي" },
  { code: "+261", flag: "🇲🇬", name: "مدغشقر" },
  { code: "+230", flag: "🇲🇺", name: "موريشيوس" },
  // ── أوقيانوسيا ──
  { code: "+61",  flag: "🇦🇺", name: "أستراليا" },
  { code: "+64",  flag: "🇳🇿", name: "نيوزيلندا" },
];

export default function LoginPage() {
  const { login: setAuthToken } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+213");
  const [showCountries, setShowCountries] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];
  const fullPhone = countryCode + phone.replace(/^0+/, "");

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال الرمز");
      setIsNewUser(data.isNewUser);
      setStep("otp");
      toast({ title: "تم إرسال الرمز ✓", description: "تحقق من واتساب الخاص بك" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return;
    if (isNewUser && !name.trim()) {
      toast({ variant: "destructive", title: "أدخل اسمك" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code: otp.trim(), name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "الرمز غير صحيح");
      setAuthToken(data.token);
      toast({ title: isNewUser ? "أهلاً بك في Gaytak 🎉" : "مرحباً بك مجدداً 👋" });
      setLocation("/");
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl shadow-[0_0_50px_rgba(168,85,247,0.15)] rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-white/5">
            <h1 className="text-2xl font-black text-white">Gaytak</h1>
            <p className="text-sm text-white/40 mt-1">
              {step === "phone" ? "أدخل رقم هاتفك للدخول" : isNewUser ? "أدخل الرمز واسمك لإنشاء حساب" : "أدخل رمز التحقق"}
            </p>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 pt-5 px-8">
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step === "phone" ? "bg-primary" : "bg-primary"}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step === "otp" ? "bg-primary" : "bg-white/10"}`} />
          </div>

          <div className="px-8 py-6">
            <AnimatePresence mode="wait">

              {/* ── Step 1: Phone ── */}
              {step === "phone" && (
                <motion.form
                  key="phone"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleSendOtp}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider font-bold">رقم الهاتف</label>

                    <div className="flex gap-2">
                      {/* Country code picker */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountries(v => !v)}
                          className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-2xl px-3 h-14 hover:border-primary/40 transition-all min-w-[90px]"
                        >
                          <span className="text-lg">{selectedCountry.flag}</span>
                          <span className="text-white font-mono text-sm">{selectedCountry.code}</span>
                          <ChevronDown className="w-3 h-3 text-white/40" />
                        </button>

                        <AnimatePresence>
                          {showCountries && (
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-16 left-0 z-50 w-52 bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-h-64 overflow-y-auto"
                            >
                              {COUNTRIES.map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => { setCountryCode(c.code); setShowCountries(false); }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-primary/10 transition-all ${countryCode === c.code ? "bg-primary/20 text-primary" : "text-white"}`}
                                >
                                  <span className="text-lg">{c.flag}</span>
                                  <span className="flex-1 text-right">{c.name}</span>
                                  <span className="font-mono text-white/40 text-xs">{c.code}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Phone number input */}
                      <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 h-14 focus-within:border-primary/50 transition-all">
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="0551234567"
                          dir="ltr"
                          className="flex-1 bg-transparent text-white placeholder:text-white/20 text-base outline-none font-mono"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-white/30 text-center">سيصلك رمز التحقق عبر واتساب</p>
                  </div>

                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={loading || !phone.trim()}
                    className="w-full h-13 py-3.5 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-40 text-base"
                  >
                    {loading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><span>إرسال رمز التحقق</span><ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </motion.form>
              )}

              {/* ── Step 2: OTP ── */}
              {step === "otp" && (
                <motion.form
                  key="otp"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4"
                >
                  {/* Phone display */}
                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <span className="text-white/50 text-xs">الهاتف</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-mono" dir="ltr">{selectedCountry.flag} {fullPhone}</span>
                      <button type="button" onClick={() => setStep("phone")} className="text-primary text-xs underline">تغيير</button>
                    </div>
                  </div>

                  {/* OTP input */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider font-bold">رمز التحقق (6 أرقام)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="● ● ● ● ● ●"
                      dir="ltr"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-14 text-center text-white text-2xl font-mono tracking-[0.5em] placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Name field for new users */}
                  {isNewUser && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      <label className="text-xs text-white/50 uppercase tracking-wider font-bold">اسمك (حساب جديد)</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="أدخل اسمك الكامل"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-12 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all text-right"
                        required
                      />
                    </motion.div>
                  )}

                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={loading || otp.length < 6}
                    className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-40 text-base"
                  >
                    {loading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><span>{isNewUser ? "إنشاء الحساب" : "تسجيل الدخول"}</span><ChevronRight className="w-4 h-4" /></>}
                  </motion.button>

                  {/* Resend */}
                  <button
                    type="button"
                    onClick={() => { setOtp(""); handleSendOtp({ preventDefault: () => {} } as any); }}
                    className="w-full text-center text-xs text-white/30 hover:text-primary transition-colors py-1"
                  >
                    إعادة إرسال الرمز
                  </button>
                </motion.form>
              )}

            </AnimatePresence>
          </div>

        </div>

        {/* Privacy Policy Card */}
        <Link href="/privacy-policy">
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="mt-3 flex flex-row-reverse items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-primary/25 cursor-pointer hover:border-primary/50 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-bold text-white">سياسة الخصوصية</p>
              <p className="text-[11px] text-white/40">باستخدام المنصة توافق على سياسة الخصوصية — اضغط لقراءتها</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 rotate-180" />
          </motion.div>
        </Link>

      </motion.div>
    </div>
  );
}
