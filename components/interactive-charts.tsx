import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Stop, Text as SvgText } from "react-native-svg";

import { useApp } from "@/lib/app-context";
import { channelDistribution, type ChartMetric, type ChartRange, trendData } from "@/lib/chart-data";
import { buildAreaPath, buildSmoothLinePath, calculatePerformanceChange, formatCompactNumber, nearestPointIndex, scaleSeries } from "@/lib/chart-utils";
import { haptic } from "@/lib/haptics";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHART_HEIGHT = 210;
const PADDING = { top: 24, right: 10, bottom: 32, left: 10 };

type InteractiveTrendChartProps = {
  range: ChartRange;
  onRangeChange?: (range: ChartRange) => void;
  compact?: boolean;
};

export function InteractiveTrendChart({ range, onRangeChange, compact = false }: InteractiveTrendChartProps) {
  const { t, language, isRTL } = useApp();
  const [metric, setMetric] = useState<ChartMetric>("sales");
  const [showComparison, setShowComparison] = useState(true);
  const [width, setWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState(trendData[range].sales.length - 1);
  const drawProgress = useRef(new Animated.Value(0)).current;
  const fadeProgress = useRef(new Animated.Value(0)).current;
  const dataset = trendData[range];
  const values = dataset[metric];
  const previousValues = metric === "sales" ? dataset.previousSales : dataset.previousProfit;
  const labels = dataset.labels[language];
  const lineColor = metric === "sales" ? "#50C2B4" : "#F3B94E";
  const gradientId = metric === "sales" ? "salesArea" : "profitArea";
  const domain = useMemo(() => {
    const combined = showComparison ? [...values, ...previousValues] : values;
    return { min: Math.min(...combined), max: Math.max(...combined) };
  }, [previousValues, showComparison, values]);
  const points = useMemo(() => scaleSeries(values, width, CHART_HEIGHT, PADDING, domain), [domain, values, width]);
  const previousPoints = useMemo(() => scaleSeries(previousValues, width, CHART_HEIGHT, PADDING, domain), [domain, previousValues, width]);
  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);
  const previousLinePath = useMemo(() => buildSmoothLinePath(previousPoints), [previousPoints]);
  const areaPath = useMemo(() => buildAreaPath(points, CHART_HEIGHT - PADDING.bottom), [points]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const previousTotal = previousValues.reduce((sum, value) => sum + value, 0);
  const overallChange = calculatePerformanceChange(total, previousTotal);
  const selected = points[selectedIndex] ?? points[points.length - 1];
  const selectedPrevious = previousPoints[selectedIndex] ?? previousPoints[previousPoints.length - 1];
  const selectedChange = calculatePerformanceChange(selected?.value ?? 0, selectedPrevious?.value ?? 0);
  const comparisonLabels = {
    current: language === "ar" ? (range === "today" ? "اليوم" : range === "week" ? "هذا الأسبوع" : "هذا الشهر") : (range === "today" ? "Today" : range === "week" ? "This week" : "This month"),
    previous: language === "ar" ? (range === "today" ? "أمس" : range === "week" ? "الأسبوع السابق" : "الشهر السابق") : (range === "today" ? "Yesterday" : range === "week" ? "Previous week" : "Previous month"),
  };

  useEffect(() => {
    setSelectedIndex(values.length - 1);
    drawProgress.setValue(0);
    fadeProgress.setValue(0);
    Animated.parallel([
      Animated.timing(drawProgress, { duration: 750, toValue: 1, useNativeDriver: false }),
      Animated.timing(fadeProgress, { duration: 450, toValue: 1, useNativeDriver: false }),
    ]).start();
  }, [drawProgress, fadeProgress, metric, range, values.length]);

  const selectFromTouch = (event: GestureResponderEvent) => {
    const index = nearestPointIndex(event.nativeEvent.locationX, points);
    if (index !== selectedIndex) {
      setSelectedIndex(index);
      haptic.selection();
    }
  };

  return (
    <View style={[styles.trendCard, compact && styles.trendCardCompact]}>
      <View className={`mb-4 flex-row items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <View className="flex-1">
          <Text className={`text-xs font-semibold text-white/65 ${isRTL ? "text-right" : "text-left"}`}>
            {metric === "sales" ? t("salesTrend") : (isRTL ? "اتجاه الأرباح" : "Profit trend")}
          </Text>
          <View className={`mt-1 flex-row items-end gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            <Text className="text-2xl font-bold text-white">{formatCompactNumber(total, language)}</Text>
            <Text className="pb-1 text-xs font-semibold text-white/55">{t("sar")}</Text>
          </View>
        </View>
        <View className={`flex-row rounded-xl bg-white/10 p-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          {(["sales", "profit"] as ChartMetric[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                haptic.selection();
                setMetric(item);
              }}
              style={[styles.metricToggle, metric === item && styles.metricToggleActive]}
            >
              <MaterialIcons name={item === "sales" ? "trending-up" : "paid"} size={15} color={metric === item ? "#0B3B3A" : "#C9DEDA"} />
              <Text style={[styles.metricToggleText, metric === item && styles.metricToggleTextActive]}>{item === "sales" ? t("sales") : (isRTL ? "الربح" : "Profit")}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className={`mb-3 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
        <View className={`flex-row items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          <MaterialIcons name={overallChange.direction === "down" ? "south-east" : "north-east"} size={14} color={overallChange.direction === "down" ? "#FF8B8B" : "#72D8A4"} />
          <Text style={{ color: overallChange.direction === "down" ? "#FF8B8B" : "#72D8A4", fontSize: 12, fontWeight: "700" }}>{overallChange.percent > 0 ? "+" : ""}{overallChange.percent.toFixed(1)}%</Text>
          <Text className="text-[10px] text-white/45">{isRTL ? "مقارنة بالفترة السابقة" : "vs previous period"}</Text>
        </View>
        <Text className="text-[10px] font-semibold text-white/45">{isRTL ? "المس الرسم لاستكشاف القيم" : "Touch the chart to explore"}</Text>
      </View>

      <View className={`mb-1 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
        <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <View className={`flex-row items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View style={[styles.currentLegend, { backgroundColor: lineColor }]} />
            <Text className="text-[10px] font-semibold text-white/70">{comparisonLabels.current}</Text>
          </View>
          {showComparison ? (
            <View className={`flex-row items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
              <View style={styles.previousLegend}><View style={styles.previousLegendDash} /><View style={styles.previousLegendDash} /></View>
              <Text className="text-[10px] font-semibold text-white/45">{comparisonLabels.previous}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic.selection();
            setShowComparison((current) => !current);
          }}
          style={[styles.compareButton, showComparison && styles.compareButtonActive]}
        >
          <MaterialIcons name="compare-arrows" size={14} color={showComparison ? "#0B3B3A" : "#C9DEDA"} />
          <Text style={[styles.compareButtonText, showComparison && styles.compareButtonTextActive]}>{isRTL ? "مقارنة" : "Compare"}</Text>
        </Pressable>
      </View>

      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={selectFromTouch}
        onResponderMove={selectFromTouch}
        style={styles.chartCanvas}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeProgress }]}>
          <Svg height={CHART_HEIGHT} width="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity="0.32" />
                <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <Line key={ratio} x1={PADDING.left} x2={width - PADDING.right} y1={PADDING.top + (CHART_HEIGHT - PADDING.top - PADDING.bottom) * ratio} y2={PADDING.top + (CHART_HEIGHT - PADDING.top - PADDING.bottom) * ratio} stroke="rgba(255,255,255,0.09)" strokeDasharray="4 5" />
            ))}
            <Path d={areaPath} fill={`url(#${gradientId})`} />
            {showComparison ? (
              <Path d={previousLinePath} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth={2.25} strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            <AnimatedPath
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1000 1000"
              strokeDashoffset={drawProgress.interpolate({ inputRange: [0, 1], outputRange: [1000, 0] })}
            />
            {selected ? (
              <G>
                <Line x1={selected.x} x2={selected.x} y1={PADDING.top - 3} y2={CHART_HEIGHT - PADDING.bottom} stroke="rgba(255,255,255,0.38)" strokeDasharray="3 4" />
                {showComparison && selectedPrevious ? (
                  <>
                    <Line x1={selected.x} x2={selected.x} y1={selected.y} y2={selectedPrevious.y} stroke={selectedChange.direction === "down" ? "#FF8B8B" : "#72D8A4"} strokeWidth={2} />
                    <Circle cx={selectedPrevious.x} cy={selectedPrevious.y} r={5} fill="#0B3B3A" stroke="rgba(255,255,255,0.65)" strokeWidth={2} />
                  </>
                ) : null}
                <Circle cx={selected.x} cy={selected.y} r={8} fill="#0B3B3A" stroke={lineColor} strokeWidth={4} />
                <SvgText x={selected.x} y={CHART_HEIGHT - 8} fill="rgba(255,255,255,0.62)" fontSize="10" fontWeight="600" textAnchor="middle">{labels[selectedIndex]}</SvgText>
              </G>
            ) : null}
            {points.map((point, index) => index !== selectedIndex && (index === 0 || index === points.length - 1) ? <Circle key={point.index} cx={point.x} cy={point.y} r={3} fill={lineColor} opacity={0.75} /> : null)}
          </Svg>
        </Animated.View>
        {selected ? (
          <View pointerEvents="none" style={[styles.tooltip, { left: Math.min(Math.max(selected.x - 64, 4), Math.max(4, width - 132)), top: Math.max(0, Math.min(selected.y, showComparison ? selectedPrevious.y : selected.y) - 78) }]}>
            <Text className="text-[10px] text-white/60">{labels[selectedIndex]}</Text>
            <Text className="mt-0.5 text-xs font-bold text-white">{new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US").format(selected.value)} {t("sar")}</Text>
            {showComparison ? (
              <>
                <Text className="mt-1 text-[9px] text-white/45">{comparisonLabels.previous}: {new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US").format(selectedPrevious.value)} {t("sar")}</Text>
                <Text style={{ color: selectedChange.direction === "down" ? "#FF8B8B" : "#72D8A4", fontSize: 10, fontWeight: "700", marginTop: 2 }}>{selectedChange.percent > 0 ? "+" : ""}{selectedChange.percent.toFixed(1)}% · {selectedChange.amount > 0 ? "+" : ""}{new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US").format(selectedChange.amount)} {t("sar")}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {onRangeChange ? (
        <View className={`mt-2 flex-row rounded-2xl bg-white/5 p-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          {(["today", "week", "month"] as ChartRange[]).map((item) => (
            <Pressable key={item} onPress={() => onRangeChange(item)} style={[styles.rangeButton, range === item && styles.rangeButtonActive]}>
              <Text className={`text-xs font-bold ${range === item ? "text-white" : "text-white/45"}`}>{t(item)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function AnimatedDistributionChart() {
  const { language, isRTL, t } = useApp();
  const [selectedId, setSelectedId] = useState(channelDistribution[0].id);
  const progress = useRef(channelDistribution.map(() => new Animated.Value(0))).current;
  const selected = channelDistribution.find((item) => item.id === selectedId) ?? channelDistribution[0];

  useEffect(() => {
    progress.forEach((value) => value.setValue(0));
    Animated.stagger(100, progress.map((value) => Animated.timing(value, { duration: 650, toValue: 1, useNativeDriver: false }))).start();
  }, [progress]);

  return (
    <View className="rounded-3xl border border-border bg-surface p-4">
      <View className={`mb-4 flex-row items-start justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
        <View>
          <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "توزيع قنوات البيع" : "Sales channel mix"}</Text>
          <Text className={`mt-1 text-[11px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اضغط على أي قناة لعرض مساهمتها" : "Tap a channel to inspect its contribution"}</Text>
        </View>
        <View className="rounded-xl bg-primary/10 px-2.5 py-1.5"><Text className="text-xs font-bold text-primary">{selected.value}%</Text></View>
      </View>
      {channelDistribution.map((item, index) => {
        const active = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              haptic.selection();
              setSelectedId(item.id);
            }}
            style={[styles.distributionRow, active && styles.distributionRowActive]}
          >
            <View className={`mb-2 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
              <View className={`flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text className={`text-xs font-semibold ${active ? "text-foreground" : "text-muted"}`}>{item.label[language]}</Text>
              </View>
              <Text className="text-[11px] font-bold text-muted">{new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US").format(item.amount)} {t("sar")}</Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-background">
              <Animated.View style={{ backgroundColor: item.color, borderRadius: 10, height: "100%", width: progress[index].interpolate({ inputRange: [0, 1], outputRange: ["0%", `${item.value}%`] }) }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trendCard: { backgroundColor: "#0B3B3A", borderRadius: 26, overflow: "hidden", padding: 18 },
  trendCardCompact: { padding: 16 },
  metricToggle: { alignItems: "center", borderRadius: 9, flexDirection: "row", gap: 4, justifyContent: "center", minHeight: 31, paddingHorizontal: 8 },
  metricToggleActive: { backgroundColor: "#FFFFFF" },
  metricToggleText: { color: "#C9DEDA", fontSize: 10, fontWeight: "700" },
  metricToggleTextActive: { color: "#0B3B3A" },
  compareButton: { alignItems: "center", borderColor: "rgba(255,255,255,0.16)", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 4, minHeight: 28, paddingHorizontal: 8 },
  compareButtonActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  compareButtonText: { color: "#C9DEDA", fontSize: 9, fontWeight: "700" },
  compareButtonTextActive: { color: "#0B3B3A" },
  currentLegend: { borderRadius: 3, height: 3, width: 18 },
  previousLegend: { flexDirection: "row", gap: 3, width: 18 },
  previousLegendDash: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 2, height: 2, width: 7 },
  chartCanvas: { height: CHART_HEIGHT, position: "relative", width: "100%" },
  tooltip: { alignItems: "center", backgroundColor: "rgba(5,31,30,0.94)", borderColor: "rgba(255,255,255,0.16)", borderRadius: 10, borderWidth: 1, minWidth: 128, paddingHorizontal: 9, paddingVertical: 6, position: "absolute" },
  rangeButton: { alignItems: "center", borderRadius: 12, flex: 1, justifyContent: "center", minHeight: 34 },
  rangeButtonActive: { backgroundColor: "rgba(255,255,255,0.13)" },
  distributionRow: { borderColor: "transparent", borderRadius: 14, borderWidth: 1, marginBottom: 5, padding: 10 },
  distributionRowActive: { backgroundColor: "#F7FAF9", borderColor: "#DDE7E4" },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
});
