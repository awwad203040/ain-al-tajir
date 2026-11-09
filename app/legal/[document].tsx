import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";

type DocumentType = "privacy" | "terms";
type Section = { title: { ar: string; en: string }; body: { ar: string; en: string } };

const DOCUMENTS: Record<DocumentType, { title: { ar: string; en: string }; intro: { ar: string; en: string }; sections: Section[] }> = {
  privacy: {
    title: { ar: "سياسة الخصوصية", en: "Privacy policy" },
    intro: { ar: "توضح هذه السياسة كيف يتعامل عين التاجر مع بيانات التاجر والمتجر عند استخدام الخدمة.", en: "This policy explains how Ain Al-Tajir handles merchant and store data when you use the service." },
    sections: [
      { title: { ar: "البيانات التي نعالجها", en: "Data we process" }, body: { ar: "قد تشمل البيانات اسم التاجر ووسيلة التواصل وبيانات المتجر والفروع والمنتجات والمبيعات والمخزون وسجلات التشغيل التي يدخلها المستخدم أو ينشئها أثناء استخدام النظام.", en: "Data may include the merchant name and contact details, store and branch information, products, sales, inventory, and operational records entered or created while using the system." } },
      { title: { ar: "الغرض من الاستخدام", en: "How data is used" }, body: { ar: "نستخدم البيانات لتشغيل لوحة المتجر، حساب المؤشرات والتقارير، تنفيذ صلاحيات الفروع، إرسال التنبيهات، دعم التجربة المجانية وإدارة الاشتراك والفواتير.", en: "We use data to operate the store dashboard, calculate insights and reports, enforce branch permissions, send alerts, provide the free trial, and manage subscriptions and invoices." } },
      { title: { ar: "الدفع والأمان", en: "Payments and security" }, body: { ar: "تتم معالجة بيانات البطاقة داخل صفحة مزود الدفع المستضافة. لا يخزن عين التاجر رقم البطاقة أو رمز CVV. نستخدم ضوابط وصول حسب الدور وسجلات تدقيق للعمليات الحساسة.", en: "Card details are processed on the payment provider's hosted page. Ain Al-Tajir does not store card numbers or CVV. Role-based access and audit logs protect sensitive operations." } },
      { title: { ar: "الاحتفاظ والطلبات", en: "Retention and requests" }, body: { ar: "نحتفظ بالبيانات اللازمة لتقديم الخدمة والسجلات المالية والتدقيقية. يمكن لصاحب الحساب طلب تصحيح بياناته أو معرفة طريقة التعامل معها عبر قنوات الدعم المعتمدة.", en: "We retain data needed to provide the service and maintain financial and audit records. The account owner may request correction or information about data handling through the approved support channels." } },
    ],
  },
  terms: {
    title: { ar: "شروط الاشتراك والاستخدام", en: "Subscription terms" },
    intro: { ar: "باستخدام عين التاجر، يوافق التاجر على الشروط التالية الخاصة بالتجربة المجانية والاشتراك الشهري.", en: "By using Ain Al-Tajir, the merchant agrees to the following terms for the free trial and monthly subscription." },
    sections: [
      { title: { ar: "التجربة المجانية", en: "Free trial" }, body: { ar: "يبدأ الحساب الجديد فترة مجانية حية لمدة 7 أيام بعد استكمال بيانات التاجر والمتجر. لا تُطلب بطاقة ولا يتم الخصم تلقائيًا أثناء التجربة. بعد انتهائها يلزم اشتراك فعال لاستمرار الوصول إلى لوحة التحكم.", en: "A new account receives a live 7-day free period after completing merchant and store details. No card is required and no automatic charge is made during the trial. After it ends, an active subscription is required to keep dashboard access." } },
      { title: { ar: "الباقة والسعر", en: "Plan and price" }, body: { ar: "باقة التاجر الحالية هي 100 ر.س شهريًا. يتجدد الاشتراك وفق إعداد مزود الدفع، ويظهر موعد التجديد وحالة الفواتير داخل صفحة الاشتراكات.", en: "The current Merchant Plan is SAR 100 per month. Renewal follows the payment provider settings, and the renewal date and invoice status appear in the subscription screen." } },
      { title: { ar: "مسؤولية البيانات", en: "Data responsibility" }, body: { ar: "يتحمل صاحب الحساب مسؤولية دقة البيانات التي يدخلها، وحماية وسائل الدخول، وتعيين مديري الفروع للمستخدمين المصرح لهم فقط. لا ينفذ النظام تغييرات حساسة دون اعتماد الصلاحية المناسبة.", en: "The account owner is responsible for data accuracy, protecting access credentials, and assigning branch managers only to authorized users. Sensitive changes require the appropriate approval." } },
      { title: { ar: "الإلغاء والدعم", en: "Cancellation and support" }, body: { ar: "يمكن إلغاء التجديد من صفحة الاشتراك عند توفر بوابة الدفع. يبقى الوصول فعالًا حتى نهاية الفترة المدفوعة بحسب حالة الاشتراك، وتُعرض الفواتير السابقة للتنزيل أو المراجعة.", en: "Renewal can be canceled from the subscription page when the payment portal is available. Access remains active through the paid period according to subscription status, and past invoices remain available for review or download." } },
    ],
  },
};

export default function LegalDocumentScreen() {
  const { document: rawDocument } = useLocalSearchParams<{ document: string }>();
  const { isRTL, language } = useApp();
  const document = (rawDocument === "terms" ? "terms" : "privacy") as DocumentType;
  const content = DOCUMENTS[document];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
        <AppHeader title={content.title[language]} subtitle={isRTL ? "آخر تحديث: 23 أكتوبر 2026" : "Last updated: October 23, 2026"} />
        <View style={styles.intro}><MaterialIcons name="verified-user" size={23} color="#0F766E" /><Text style={[styles.introText, isRTL && styles.right]}>{content.intro[language]}</Text></View>
        {content.sections.map((section) => <View key={section.title.en} style={styles.section}><Text style={[styles.sectionTitle, isRTL && styles.right]}>{section.title[language]}</Text><Text style={[styles.sectionBody, isRTL && styles.right]}>{section.body[language]}</Text></View>)}
        <Text style={[styles.footer, isRTL && styles.right]}>{isRTL ? "هذه الصفحة توضيحية داخل التطبيق ولا تستبدل المراجعة القانونية المحلية قبل الإطلاق التجاري." : "This in-app page is informational and does not replace local legal review before commercial launch."}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { paddingBottom: 32, paddingTop: 12 }, backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 20, width: 44 }, intro: { alignItems: "flex-start", backgroundColor: "#EAF4F2", borderColor: "#B8DAD6", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, padding: 15 }, introText: { color: "#176458", flex: 1, fontSize: 13, lineHeight: 22 }, section: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 15 }, sectionTitle: { color: "#14201F", fontSize: 14, fontWeight: "800" }, sectionBody: { color: "#526E69", fontSize: 12, lineHeight: 21, marginTop: 7 }, footer: { color: "#8AA09C", fontSize: 10, lineHeight: 17, marginTop: 18 }, right: { textAlign: "right" } });
