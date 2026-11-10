import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ar" | "en";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  dueLabel: string;
};

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  ar: {
    appName: "عين التاجر",
    connectSource: "ربط مصدر بيانات",
    home: "الرئيسية",
    sales: "المبيعات",
    lossCenter: "مركز الخسائر",
    inventory: "المخزون",
    more: "المزيد",
    today: "اليوم",
    week: "الأسبوع",
    month: "الشهر",
    greeting: "مرحبًا بك في عين التاجر",
    storeOverview: "ابدأ بربط بيانات متجرك لتظهر مؤشراتك الفعلية.",
    versusYesterday: "مقارنة بأمس",
    sar: "ر.س",
    whatToday: "ماذا أفعل اليوم؟",
    orderedByImpact: "مرتبة حسب الأثر المالي والثقة والاستعجال",
    viewDetails: "عرض التفاصيل",
    actual: "بيانات فعلية",
    estimate: "تقدير",
    forecast: "توقع",
    high: "عالية",
    medium: "متوسطة",
    low: "منخفضة",
    financialImpact: "الأثر المالي المقدر",
    confidence: "الثقة",
    why: "لماذا اقترح النظام ذلك؟",
    createTask: "تحويل إلى مهمة",
    taskCreated: "تم إنشاء المهمة",
    allBranches: "كل الفروع",
    salesTrend: "اتجاه المبيعات",
    netSales: "صافي المبيعات",
    orders: "الطلبات",
    averageBasket: "متوسط السلة",
    topChannel: "أفضل قناة",
    onlineStore: "المتجر الإلكتروني",
    cash: "نقدي",
    mada: "مدى",
    inventoryHealth: "صحة المخزون",
    searchProduct: "ابحث بالمنتج أو SKU",
    lowStock: "منخفض",
    excessStock: "زائد",
    healthy: "طبيعي",
    daysCoverage: "أيام التغطية",
    dailySales: "متوسط البيع اليومي",
    recommendedOrder: "الطلب المقترح",
    productsAtRisk: "منتجات تحتاج انتباهًا",
    detectedLosses: "مشكلات مكتشفة",
    impactTotal: "إجمالي الأثر المحتمل",
    evidence: "البيانات الداعمة",
    suggestedAction: "الإجراء المقترح",
    assistant: "مساعد عين التاجر",
    askAssistant: "اسأل عن متجرك…",
    send: "إرسال",
    suggestedQuestions: "أسئلة مقترحة",
    insufficientData: "لا توجد بيانات كافية لإعطاء نتيجة دقيقة.",
    moreTools: "أدوات الإدارة",
    management: "التشغيل والتحليل",
    settingsAndAccess: "الإعدادات والوصول",
    language: "اللغة",
    arabic: "العربية",
    english: "English",
    back: "رجوع",
    continue: "متابعة",
    login: "تسجيل الدخول",
    createAccount: "إنشاء حساب",
    welcome: "رؤية أوضح لمتجرك، كل يوم.",
    emailOrMobile: "البريد الإلكتروني أو رقم الجوال",
    password: "كلمة المرور",
    tryDemo: "الدخول إلى النسخة التجريبية",
    noAccount: "ليس لديك حساب؟",
    fullName: "الاسم الكامل",
    mobile: "رقم الجوال",
    email: "البريد الإلكتروني",
    registerSubtitle: "أنشئ حساب المالك، ثم أضف متجرك.",
    setupStore: "إعداد المتجر",
    storeName: "اسم المتجر",
    businessType: "النشاط",
    city: "المدينة",
    branchesCount: "عدد الفروع",
    chooseSystem: "اختر مصدر بياناتك",
    connectLater: "سأربط لاحقًا",
    startAnalysis: "بدء التحليل",
    open: "فتح",
    status: "الحالة",
    all: "الكل",
    completed: "مكتملة",
    pending: "قيد المتابعة",
  },
  en: {
    appName: "Ain Al-Tajir",
    connectSource: "Connect data source",
    home: "Home",
    sales: "Sales",
    lossCenter: "Loss Center",
    inventory: "Inventory",
    more: "More",
    today: "Today",
    week: "Week",
    month: "Month",
    greeting: "Welcome to Ain Al-Tajir",
    storeOverview: "Connect your store data to see your actual indicators.",
    versusYesterday: "vs. yesterday",
    sar: "SAR",
    whatToday: "What should I do today?",
    orderedByImpact: "Ranked by financial impact, confidence, and urgency",
    viewDetails: "View details",
    actual: "Actual data",
    estimate: "Estimate",
    forecast: "Forecast",
    high: "High",
    medium: "Medium",
    low: "Low",
    financialImpact: "Estimated financial impact",
    confidence: "Confidence",
    why: "Why did the system suggest this?",
    createTask: "Convert to task",
    taskCreated: "Task created",
    allBranches: "All branches",
    salesTrend: "Sales trend",
    netSales: "Net sales",
    orders: "Orders",
    averageBasket: "Average basket",
    topChannel: "Top channel",
    onlineStore: "Online store",
    cash: "Cash",
    mada: "Mada",
    inventoryHealth: "Inventory health",
    searchProduct: "Search product or SKU",
    lowStock: "Low",
    excessStock: "Excess",
    healthy: "Healthy",
    daysCoverage: "Days of coverage",
    dailySales: "Average daily sales",
    recommendedOrder: "Recommended order",
    productsAtRisk: "Products needing attention",
    detectedLosses: "Detected issues",
    impactTotal: "Total potential impact",
    evidence: "Supporting data",
    suggestedAction: "Suggested action",
    assistant: "Ain Al-Tajir Assistant",
    askAssistant: "Ask about your store…",
    send: "Send",
    suggestedQuestions: "Suggested questions",
    insufficientData: "There is not enough data to give an accurate answer.",
    moreTools: "Management tools",
    management: "Operations and analysis",
    settingsAndAccess: "Settings and access",
    language: "Language",
    arabic: "العربية",
    english: "English",
    back: "Back",
    continue: "Continue",
    login: "Sign in",
    createAccount: "Create account",
    welcome: "A clearer view of your store, every day.",
    emailOrMobile: "Email or mobile number",
    password: "Password",
    tryDemo: "Enter demo experience",
    noAccount: "Don't have an account?",
    fullName: "Full name",
    mobile: "Mobile number",
    email: "Email address",
    registerSubtitle: "Create the owner account, then add your store.",
    setupStore: "Set up store",
    storeName: "Store name",
    businessType: "Business type",
    city: "City",
    branchesCount: "Number of branches",
    chooseSystem: "Choose your data source",
    connectLater: "I'll connect later",
    startAnalysis: "Start analysis",
    open: "Open",
    status: "Status",
    all: "All",
    completed: "Completed",
    pending: "In progress",
  },
};

type AppContextValue = {
  language: Language;
  isRTL: boolean;
  isReady: boolean;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string) => string;
  formatCurrency: (value: number | string) => string;
  tasks: Task[];
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const LANGUAGE_KEY = "ain-altajir-language";
const TASKS_KEY = "ain-altajir-tasks";

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [isReady, setIsReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    { id: "task-1", title: "مراجعة فرق المخزون في فرع الرياض", completed: false, dueLabel: "اليوم، 4:00 م" },
    { id: "task-2", title: "اعتماد طلب إعادة المخزون", completed: true, dueLabel: "اكتملت اليوم" },
  ]);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(LANGUAGE_KEY), AsyncStorage.getItem(TASKS_KEY)])
      .then(([storedLanguage, storedTasks]) => {
        if (!mounted) return;
        if (storedLanguage === "ar" || storedLanguage === "en") setLanguageState(storedLanguage);
        if (storedTasks) {
          try {
            const parsed = JSON.parse(storedTasks) as Task[];
            if (Array.isArray(parsed)) setTasks(parsed);
          } catch {}
        }
      })
      .catch((err) => {
        console.warn("[AppContext] storage load error:", err);
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    // Fallback timer: ensure isReady becomes true within 200ms
    const timer = setTimeout(() => {
      if (mounted) setIsReady(true);
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isReady) void AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [isReady, tasks]);

  const setLanguage = async (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const value = useMemo<AppContextValue>(() => {
    const locale = language === "ar" ? "ar-SA" : "en-SA";
    return {
      language,
      isRTL: language === "ar",
      isReady,
      setLanguage,
      t: (key) => dictionaries[language][key] ?? key,
      formatCurrency: (value) => `${new Intl.NumberFormat(locale).format(Number(value))} ${dictionaries[language].sar}`,
      tasks,
      addTask: (title) => {
        setTasks((current) => [
          { id: `task-${Date.now()}`, title, completed: false, dueLabel: language === "ar" ? "اليوم" : "Today" },
          ...current,
        ]);
      },
      toggleTask: (id) => {
        setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
      },
    };
  }, [isReady, language, tasks]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
