export type ChartPoint = {
  x: number;
  y: number;
  value: number;
  index: number;
};

export type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function scaleSeries(
  values: number[],
  width: number,
  height: number,
  padding: ChartPadding,
  domain?: { min: number; max: number },
): ChartPoint[] {
  if (!values.length || width <= 0 || height <= 0) return [];
  const min = domain?.min ?? Math.min(...values);
  const max = domain?.max ?? Math.max(...values);
  const range = max - min || 1;
  const chartWidth = Math.max(1, width - padding.left - padding.right);
  const chartHeight = Math.max(1, height - padding.top - padding.bottom);
  const step = values.length > 1 ? chartWidth / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: padding.left + index * step,
    y: padding.top + chartHeight - ((value - min) / range) * chartHeight,
    value,
    index,
  }));
}

export function calculatePerformanceChange(current: number, previous: number) {
  const amount = current - previous;
  const percent = previous === 0 ? 0 : (amount / previous) * 100;
  const direction = amount > 0 ? "up" : amount < 0 ? "down" : "flat";
  return { amount, percent, direction } as const;
}

export function buildSmoothLinePath(points: ChartPoint[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = (previous.x + current.x) / 2;
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export function buildAreaPath(points: ChartPoint[], baseline: number) {
  const line = buildSmoothLinePath(points);
  if (!line || !points.length) return "";
  return `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

export function nearestPointIndex(locationX: number, points: ChartPoint[]) {
  if (!points.length) return 0;
  return points.reduce((closest, point, index) => {
    const currentDistance = Math.abs(point.x - locationX);
    const closestDistance = Math.abs(points[closest].x - locationX);
    return currentDistance < closestDistance ? index : closest;
  }, 0);
}

export function formatCompactNumber(value: number, language: "ar" | "en") {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}${language === "ar" ? "م" : "M"}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}${language === "ar" ? "ألف" : "K"}`;
  return new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US").format(value);
}
