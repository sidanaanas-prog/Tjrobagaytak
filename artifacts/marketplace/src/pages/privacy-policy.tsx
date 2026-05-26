import { Link } from "wouter";
import { ArrowRight, Shield, Lock } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const SECTIONS = [
  {
    title: "مقدمة",
    body: `مرحباً بك في Gaytak. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. تُوضّح هذه السياسة كيفية جمعنا للمعلومات واستخدامها وحمايتها عند استخدامك للمنصة.`,
  },
  {
    title: "المعلومات التي نجمعها",
    body: `• رقم الهاتف: لإنشاء حسابك والتحقق من هويتك عبر رمز OTP.\n• الاسم: لعرض ملفك الشخصي للمستخدمين الآخرين.\n• صورة الملف الشخصي: اختيارية، تُستخدم لتخصيص حسابك.\n• بيانات المنتجات: العنوان والوصف والسعر والصور التي ترفعها عند إنشاء إعلان.`,
  },
  {
    title: "كيف نستخدم معلوماتك",
    body: `• تشغيل خدمات المنصة: تسجيل الدخول، عرض الإعلانات، والمراسلة بين المستخدمين.\n• تحسين الخدمة: تحليل الاستخدام بشكل مجمّع لتطوير المنصة.\n• سلامة المنصة: مراجعة المحتوى للتأكد من مطابقته لشروط الاستخدام.`,
  },
  {
    title: "مشاركة المعلومات مع الأطراف الثالثة",
    body: `لا نبيع بياناتك الشخصية ولا نُشاركها مع أطراف خارجية لأغراض تجارية. قد نشارك معلوماتك في الحالات التالية فقط:\n• مزودو الخدمات الضروريون لتشغيل المنصة.\n• المتطلبات القانونية: في حال صدور أمر قضائي أو التزام قانوني.`,
  },
  {
    title: "تخزين البيانات وأمانها",
    body: `تُخزَّن بياناتك على خوادم آمنة محمية بتشفير HTTPS. نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف الحساب، تُحذف جميع بياناتك الشخصية ومنتجاتك ورسائلك فوراً وبشكل نهائي.`,
  },
  {
    title: "حقوقك",
    body: `يحق لك في أي وقت:\n• الاطلاع على بياناتك الشخصية المحفوظة لدينا.\n• تعديل معلوماتك من ملفك الشخصي.\n• حذف حسابك نهائياً وجميع بياناتك من داخل التطبيق أو الموقع.\n\nللتواصل بشأن بياناتك: support@gaytak.com`,
  },
  {
    title: "محتوى المستخدمين",
    body: `المنتجات والصور والرسائل التي تنشرها تبقى ملكاً لك. بنشرها على المنصة، تمنحنا ترخيصاً محدوداً لعرضها للمستخدمين الآخرين ضمن خدمات المنصة فقط.`,
  },
  {
    title: "الأطفال",
    body: `المنصة مخصصة للمستخدمين الذين تجاوزوا سن 16 عاماً. لا نجمع بيانات من الأطفال دون سن 16 عن قصد.`,
  },
  {
    title: "التعديلات على السياسة",
    body: `قد نُحدّث هذه السياسة من وقت لآخر. استمرار استخدامك للمنصة بعد نشر التغييرات يعني موافقتك عليها.`,
  },
  {
    title: "التواصل معنا",
    body: `لأي استفسار بشأن سياسة الخصوصية أو طلب حذف بياناتك:\n📧 support@gaytak.com\n\nسنرد على طلبك خلال 5 أيام عمل.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen" dir="rtl">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </Link>
          <h1 className="text-base font-black text-white">سياسة الخصوصية</h1>
        </div>

        <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-4">

          {/* Top badge */}
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              آخر تحديث: أبريل 2026
            </div>
          </div>

          {/* Intro */}
          <p className="text-sm text-white/50 leading-6 text-right">
            منصة <span className="text-primary font-black">Gaytak</span> تلتزم بحماية خصوصيتك. اقرأ هذه السياسة بعناية لتفهم كيف نتعامل مع بياناتك.
          </p>

          {/* Sections */}
          {SECTIONS.map((sec, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3 flex-row-reverse">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <h2 className="text-sm font-black text-white">{sec.title}</h2>
              </div>
              <p className="text-sm text-white/50 leading-6 whitespace-pre-line text-right">{sec.body}</p>
            </div>
          ))}

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 pt-4 pb-8 border-t border-white/5 text-white/30 text-xs">
            <Lock className="w-3 h-3" />
            Gaytak — جميع الحقوق محفوظة © 2026
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
