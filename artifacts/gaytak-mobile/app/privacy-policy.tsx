import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SECTIONS = [
  {
    title: "مقدمة",
    body: `مرحباً بك في تطبيق Gaytak. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. تُوضّح هذه السياسة كيفية جمعنا للمعلومات واستخدامها وحمايتها عند استخدامك للتطبيق.`,
  },
  {
    title: "المعلومات التي نجمعها",
    body: `• رقم الهاتف: لإنشاء حسابك والتحقق من هويتك عبر رمز OTP.\n• الاسم: لعرض ملفك الشخصي للمستخدمين الآخرين.\n• صورة الملف الشخصي: اختيارية، تُستخدم لتخصيص حسابك.\n• بيانات المنتجات: العنوان والوصف والسعر والصور التي ترفعها عند إنشاء إعلان.\n• رمز الإشعارات: لإرسال إشعارات فورية إليك (رسائل جديدة، حالة المنتجات).`,
  },
  {
    title: "كيف نستخدم معلوماتك",
    body: `• تشغيل خدمات التطبيق: تسجيل الدخول، عرض الإعلانات، والمراسلة بين المستخدمين.\n• إرسال الإشعارات: إعلامك برسائل جديدة أو تحديثات تخص إعلاناتك.\n• تحسين الخدمة: تحليل الاستخدام بشكل مجمّع لتطوير التطبيق.\n• سلامة المنصة: مراجعة المحتوى للتأكد من مطابقته لشروط الاستخدام.`,
  },
  {
    title: "مشاركة المعلومات مع الأطراف الثالثة",
    body: `لا نبيع بياناتك الشخصية ولا نُشاركها مع أطراف خارجية لأغراض تجارية. قد نشارك معلوماتك في الحالات التالية فقط:\n• مزودو الخدمات الضروريون لتشغيل التطبيق (مثل خدمات الإشعارات).\n• المتطلبات القانونية: في حال صدور أمر قضائي أو التزام قانوني.\n• حماية الحقوق: للدفاع عن حقوق المستخدمين أو المنصة عند الضرورة.`,
  },
  {
    title: "الإشعارات الفورية",
    body: `يستخدم التطبيق خدمة Expo Push Notifications لإرسال الإشعارات. عند منحك الإذن، نحصل على رمز جهازك ونحفظه بشكل آمن لإرسال الإشعارات إليك فقط. يمكنك إيقاف الإشعارات في أي وقت من إعدادات جهازك.`,
  },
  {
    title: "تخزين البيانات وأمانها",
    body: `تُخزَّن بياناتك على خوادم آمنة محمية بتشفير HTTPS. نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف الحساب، تُحذف جميع بياناتك الشخصية ومنتجاتك ورسائلك فوراً وبشكل نهائي. لا يمكننا ضمان الأمان الكامل لأي نقل عبر الإنترنت، لكننا نطبّق أفضل الممارسات الأمنية.`,
  },
  {
    title: "حقوقك",
    body: `يحق لك في أي وقت:\n• الاطلاع على بياناتك الشخصية المحفوظة لدينا.\n• تعديل معلوماتك من ملفك الشخصي داخل التطبيق.\n• حذف حسابك نهائياً: يمكنك حذف حسابك وجميع بياناتك ومنتجاتك في أي وقت من داخل التطبيق مباشرةً عبر الملف الشخصي ← "حذف الحساب نهائياً".\n• إيقاف الإشعارات الفورية من إعدادات جهازك.\n\nعند حذف الحساب تُحذف جميع بياناتك الشخصية ومنتجاتك ورسائلك فوراً ولا يمكن استعادتها.\n\nللتواصل بشأن بياناتك يُرجى مراسلتنا على: support@gaytak.com`,
  },
  {
    title: "محتوى المستخدمين",
    body: `المنتجات والصور والرسائل التي تنشرها تبقى ملكاً لك. بنشرها على المنصة، تمنحنا ترخيصاً محدوداً لعرضها للمستخدمين الآخرين ضمن خدمات التطبيق فقط. لا نستخدم محتواك لأغراض تجارية خارج التطبيق.`,
  },
  {
    title: "الأطفال",
    body: `التطبيق مخصص للمستخدمين الذين تجاوزوا سن 16 عاماً. لا نجمع بيانات من الأطفال دون سن 16 عن قصد. إذا اكتشفنا أن طفلاً قد قدّم بياناته، سنحذفها فوراً.`,
  },
  {
    title: "التعديلات على السياسة",
    body: `قد نُحدّث هذه السياسة من وقت لآخر. سنُعلمك بأي تغييرات جوهرية عبر إشعار داخل التطبيق. استمرار استخدامك للتطبيق بعد نشر التغييرات يعني موافقتك عليها.`,
  },
  {
    title: "التواصل معنا",
    body: `لأي استفسار بشأن سياسة الخصوصية أو طلب حذف بياناتك:\n📧 support@gaytak.com\n\nسنرد على طلبك خلال 5 أيام عمل.`,
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>سياسة الخصوصية</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top badge */}
        <View style={[styles.topBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
          <Feather name="shield" size={20} color={colors.primary} />
          <Text style={[styles.topBadgeText, { color: colors.primary }]}>
            آخر تحديث: أبريل 2026
          </Text>
        </View>

        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          تطبيق <Text style={{ color: colors.primary, fontWeight: "800" }}>Gaytak</Text> يلتزم بحماية
          خصوصيتك. اقرأ هذه السياسة بعناية لتفهم كيف نتعامل مع بياناتك.
        </Text>

        {SECTIONS.map((sec, i) => (
          <View key={i} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.numBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{sec.title}</Text>
            </View>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{sec.body}</Text>
          </View>
        ))}

        <View style={[styles.footer, { borderColor: colors.border }]}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Gaytak — جميع الحقوق محفوظة © 2026
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  topBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  topBadgeText: { fontSize: 12, fontWeight: "700" },
  intro: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginBottom: 8,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  numBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  sectionTitle: { fontSize: 15, fontWeight: "800", flex: 1, textAlign: "right" },
  sectionBody: { fontSize: 13, lineHeight: 22, textAlign: "right" },
  footer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 12 },
});
