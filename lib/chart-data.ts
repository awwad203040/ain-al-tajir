import type { Language } from "@/lib/app-context";

export type ChartRange = "today" | "week" | "month";
export type ChartMetric = "sales" | "profit";

type TrendDataset = {
  labels: Record<Language, string[]>;
  sales: number[];
  profit: number[];
  previousSales: number[];
  previousProfit: number[];
  salesDelta: number;
  profitDelta: number;
};

export const trendData: Record<ChartRange, TrendDataset> = {
  today: {
    labels: {
      ar: ["٨ ص", "١٠ ص", "١٢ م", "٢ م", "٤ م", "٦ م", "٨ م", "١٠ م"],
      en: ["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM", "10 PM"],
    },
    sales: [3200, 4800, 6100, 5200, 7200, 8400, 7600, 6220],
    profit: [680, 1040, 1460, 1180, 1680, 2060, 1840, 1400],
    previousSales: [3400, 4600, 5700, 5000, 6500, 7600, 6800, 5340],
    previousProfit: [650, 990, 1380, 1190, 1590, 1900, 1700, 1389],
    salesDelta: 8.4,
    profitDelta: 5.1,
  },
  week: {
    labels: {
      ar: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],
      en: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    sales: [39200, 44800, 41600, 51200, 48700, 56600, 45350],
    profit: [8800, 10100, 9300, 11900, 11200, 13400, 10450],
    previousSales: [36000, 39800, 38700, 44200, 43100, 49300, 39193],
    previousProfit: [8200, 9200, 8600, 10600, 10100, 11900, 9968],
    salesDelta: 12.8,
    profitDelta: 9.6,
  },
  month: {
    labels: {
      ar: ["١", "٥", "٩", "١٣", "١٧", "٢١", "٢٥", "٢٩"],
      en: ["1", "5", "9", "13", "17", "21", "25", "29"],
    },
    sales: [28400, 33600, 41200, 38700, 45200, 49800, 43800, 46750],
    profit: [6200, 7600, 9700, 8800, 10800, 11900, 10100, 10950],
    previousSales: [26000, 30000, 35800, 34200, 38500, 42100, 36700, 40945],
    previousProfit: [5700, 6900, 8600, 8000, 9600, 10500, 9000, 9968],
    salesDelta: 15.2,
    profitDelta: 11.4,
  },
};

export const channelDistribution = [
  { id: "online", label: { ar: "المتجر الإلكتروني", en: "Online store" }, value: 44, amount: 144100, color: "#27A99B" },
  { id: "pos", label: { ar: "نقاط البيع", en: "Point of sale" }, value: 38, amount: 124430, color: "#5A76C8" },
  { id: "delivery", label: { ar: "تطبيقات التوصيل", en: "Delivery apps" }, value: 18, amount: 58920, color: "#E49A2E" },
];
