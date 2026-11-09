export type LocalizedText = { ar: string; en: string };

export type Metric = {
  id: string;
  label: LocalizedText;
  value: string;
  delta: string;
  tone: "primary" | "success" | "warning" | "error";
  icon: string;
};

export type ActionItem = {
  id: string;
  title: LocalizedText;
  detail: LocalizedText;
  impact: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  icon: string;
};

export type InventoryItem = {
  id: string;
  name: LocalizedText;
  sku: string;
  quantity: number;
  dailySales: number;
  coverageDays: number;
  status: "low" | "excess" | "healthy";
  trend: number;
};

export const dashboardMetrics: Metric[] = [
  {
    id: "sales",
    label: { ar: "مبيعات اليوم", en: "Today's sales" },
    value: "48,720",
    delta: "+8.4%",
    tone: "primary",
    icon: "payments",
  },
  {
    id: "profit",
    label: { ar: "الربح التقديري", en: "Estimated profit" },
    value: "11,340",
    delta: "+5.1%",
    tone: "success",
    icon: "trending-up",
  },
  {
    id: "loss",
    label: { ar: "خسائر محتملة", en: "Potential losses" },
    value: "3,860",
    delta: "3 تنبيهات",
    tone: "error",
    icon: "warning-amber",
  },
  {
    id: "stock",
    label: { ar: "قيمة المخزون", en: "Inventory value" },
    value: "284,600",
    delta: "1,248 منتج",
    tone: "warning",
    icon: "inventory-2",
  },
];

export const recommendedActions: ActionItem[] = [
  {
    id: "riyadh-gap",
    title: { ar: "راجع فرق مخزون فرع الرياض", en: "Review Riyadh stock variance" },
    detail: {
      ar: "فرق غير معتاد في 4 منتجات خلال آخر 48 ساعة.",
      en: "Unusual variance across 4 products in the last 48 hours.",
    },
    impact: "2,450",
    priority: "high",
    confidence: 92,
    icon: "inventory",
  },
  {
    id: "reorder",
    title: { ar: "أعد طلب 7 منتجات", en: "Reorder 7 products" },
    detail: {
      ar: "ستصل إلى حد إعادة الطلب خلال 5 أيام.",
      en: "They will reach the reorder point within 5 days.",
    },
    impact: "1,920",
    priority: "high",
    confidence: 88,
    icon: "shopping-bag",
  },
  {
    id: "supplier-cost",
    title: { ar: "راجع سعر مورد المشروبات", en: "Review beverage supplier pricing" },
    detail: {
      ar: "ارتفعت تكلفة 3 منتجات بمتوسط 9% هذا الشهر.",
      en: "The cost of 3 products rose by an average of 9% this month.",
    },
    impact: "1,250",
    priority: "medium",
    confidence: 84,
    icon: "local-shipping",
  },
];

export const inventoryItems: InventoryItem[] = [
  {
    id: "arabic-coffee",
    name: { ar: "قهوة عربية 250 جم", en: "Arabic Coffee 250g" },
    sku: "CF-AR-250",
    quantity: 36,
    dailySales: 12,
    coverageDays: 3,
    status: "low",
    trend: 15,
  },
  {
    id: "dates",
    name: { ar: "تمر خلاص فاخر", en: "Premium Khalas Dates" },
    sku: "DT-KH-500",
    quantity: 72,
    dailySales: 9,
    coverageDays: 8,
    status: "low",
    trend: 8,
  },
  {
    id: "paper-cups",
    name: { ar: "أكواب ورقية 12 أونصة", en: "12oz Paper Cups" },
    sku: "PK-CUP-12",
    quantity: 940,
    dailySales: 18,
    coverageDays: 52,
    status: "excess",
    trend: -4,
  },
  {
    id: "water",
    name: { ar: "مياه معدنية 330 مل", en: "Mineral Water 330ml" },
    sku: "DR-WT-330",
    quantity: 420,
    dailySales: 38,
    coverageDays: 11,
    status: "healthy",
    trend: 3,
  },
  {
    id: "chocolate",
    name: { ar: "شوكولاتة داكنة", en: "Dark Chocolate" },
    sku: "SN-CH-080",
    quantity: 24,
    dailySales: 7,
    coverageDays: 3,
    status: "low",
    trend: 21,
  },
];

export const salesBars = [42, 58, 49, 72, 66, 88, 79];

export const branchPerformance = [
  { id: "riyadh", name: { ar: "فرع الرياض", en: "Riyadh Branch" }, sales: "24,860", delta: "+12.4%", score: 92 },
  { id: "jeddah", name: { ar: "فرع جدة", en: "Jeddah Branch" }, sales: "15,420", delta: "+4.2%", score: 78 },
  { id: "dammam", name: { ar: "فرع الدمام", en: "Dammam Branch" }, sales: "8,440", delta: "-6.8%", score: 61 },
];

export const moduleContent = {
  purchases: {
    title: { ar: "المشتريات", en: "Purchases" },
    subtitle: { ar: "أوامر الشراء والاحتياج المتوقع", en: "Purchase orders and expected demand" },
    icon: "shopping-cart",
    stats: [
      { label: { ar: "طلبات مفتوحة", en: "Open orders" }, value: "8" },
      { label: { ar: "قيد الاستلام", en: "In transit" }, value: "3" },
      { label: { ar: "القيمة هذا الشهر", en: "Value this month" }, value: "74,200" },
    ],
  },
  suppliers: {
    title: { ar: "الموردون", en: "Suppliers" },
    subtitle: { ar: "السعر والالتزام ومدة التوريد", en: "Pricing, reliability, and lead time" },
    icon: "local-shipping",
    stats: [
      { label: { ar: "موردون نشطون", en: "Active suppliers" }, value: "14" },
      { label: { ar: "متوسط الالتزام", en: "Average reliability" }, value: "91%" },
      { label: { ar: "تغير التكلفة", en: "Cost movement" }, value: "+3.2%" },
    ],
  },
  branches: {
    title: { ar: "الفروع", en: "Branches" },
    subtitle: { ar: "مقارنة الأداء التشغيلي والمالي", en: "Compare financial and operating performance" },
    icon: "storefront",
    stats: [
      { label: { ar: "عدد الفروع", en: "Branches" }, value: "3" },
      { label: { ar: "الأفضل أداءً", en: "Top performer" }, value: "الرياض" },
      { label: { ar: "يحتاج مراجعة", en: "Needs review" }, value: "الدمام" },
    ],
  },
  integrations: {
    title: { ar: "التكاملات", en: "Integrations" },
    subtitle: { ar: "مصادر بيانات المتجر وحالة المزامنة", en: "Store data sources and sync status" },
    icon: "hub",
    stats: [
      { label: { ar: "متصل", en: "Connected" }, value: "2" },
      { label: { ar: "بحاجة لإجراء", en: "Needs action" }, value: "1" },
      { label: { ar: "آخر مزامنة", en: "Last sync" }, value: "قبل 8 د" },
    ],
  },
  notifications: {
    title: { ar: "التنبيهات", en: "Alerts" },
    subtitle: { ar: "المخزون والمبيعات والمزامنة", en: "Inventory, sales, and synchronization" },
    icon: "notifications-none",
    stats: [
      { label: { ar: "غير مقروءة", en: "Unread" }, value: "7" },
      { label: { ar: "عالية", en: "High severity" }, value: "2" },
      { label: { ar: "مؤجلة", en: "Snoozed" }, value: "3" },
    ],
  },
  tasks: {
    title: { ar: "المهام", en: "Tasks" },
    subtitle: { ar: "حوّل الرؤى إلى إجراءات قابلة للمتابعة", en: "Turn insights into trackable actions" },
    icon: "task-alt",
    stats: [
      { label: { ar: "مفتوحة", en: "Open" }, value: "5" },
      { label: { ar: "تستحق اليوم", en: "Due today" }, value: "2" },
      { label: { ar: "مكتملة", en: "Completed" }, value: "18" },
    ],
  },
  reports: {
    title: { ar: "التقارير", en: "Reports" },
    subtitle: { ar: "تقارير جاهزة للتصدير حسب الصلاحيات", en: "Permission-aware reports ready to export" },
    icon: "description",
    stats: [
      { label: { ar: "تقارير محفوظة", en: "Saved reports" }, value: "6" },
      { label: { ar: "هذا الشهر", en: "This month" }, value: "12" },
      { label: { ar: "مجدولة", en: "Scheduled" }, value: "3" },
    ],
  },
  employees: {
    title: { ar: "الموظفون", en: "Employees" },
    subtitle: { ar: "الأدوار والصلاحيات والوصول", en: "Roles, permissions, and access" },
    icon: "groups",
    stats: [
      { label: { ar: "المستخدمون", en: "Users" }, value: "18" },
      { label: { ar: "مديرو الفروع", en: "Branch managers" }, value: "3" },
      { label: { ar: "قراءة فقط", en: "Read only" }, value: "2" },
    ],
  },
  settings: {
    title: { ar: "الإعدادات", en: "Settings" },
    subtitle: { ar: "اللغة والإشعارات وتفضيلات المتجر", en: "Language, alerts, and store preferences" },
    icon: "settings",
    stats: [],
  },
  subscription: {
    title: { ar: "الاشتراك", en: "Subscription" },
    subtitle: { ar: "باقة التاجر الشهرية ووسائل الدفع", en: "Monthly merchant plan and payment methods" },
    icon: "workspace-premium",
    stats: [
      { label: { ar: "الباقة", en: "Plan" }, value: "Merchant" },
      { label: { ar: "السعر الشهري", en: "Monthly price" }, value: "100 SAR" },
      { label: { ar: "الحالة", en: "Status" }, value: "Inactive" },
    ],
  },
  admin: {
    title: { ar: "إدارة المنصة", en: "Platform Admin" },
    subtitle: { ar: "مؤشرات تشغيل المنصة للمخولين فقط", en: "Platform operations for authorized users only" },
    icon: "admin-panel-settings",
    stats: [
      { label: { ar: "متاجر نشطة", en: "Active stores" }, value: "248" },
      { label: { ar: "مزامنات ناجحة", en: "Successful syncs" }, value: "99.2%" },
      { label: { ar: "أخطاء تحتاج مراجعة", en: "Errors to review" }, value: "11" },
    ],
  },
} as const;

export type ModuleSlug = keyof typeof moduleContent;
