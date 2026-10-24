// === UTILS ===

export function formatNumber(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'Không có dữ liệu';
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatRainfall(mm: number | null | undefined): string {
  if (mm === null || mm === undefined) return '—';
  return `${formatNumber(mm, 1)} mm`;
}

export function formatTemperature(c: number | null | undefined): string {
  if (c === null || c === undefined) return '—';
  return `${formatNumber(c, 1)}°C`;
}

export function formatHumidity(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '—';
  return `${formatNumber(pct, 1)}%`;
}

export function formatDate(dateStr: string): string {
  const label = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (label) return `${label[3]}/${label[2]}/${label[1]}`;
  const d = new Date(dateStr);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }) : dateStr;
}

export function formatMonthYear(year: number, month: number): string {
  const monthNames = ['Th.1', 'Th.2', 'Th.3', 'Th.4', 'Th.5', 'Th.6', 'Th.7', 'Th.8', 'Th.9', 'Th.10', 'Th.11', 'Th.12'];
  return `${monthNames[month - 1]}/${year}`;
}

export function getMonthName(month: number): string {
  const names = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  return names[month - 1] || '';
}

export function computeStats(values: (number | null)[]): {
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  count: number;
} {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return { mean: null, median: null, stdDev: null, min: null, max: null, count: 0 };

  const sorted = [...valid].sort((a, b) => a - b);
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;

  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: valid.length,
  };
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    rainfall_mm: 'Lượng mưa (mm)',
    temperature_c: 'Nhiệt độ (°C)',
    humidity_pct: 'Độ ẩm (%)',
    river_level_m: 'Mực nước (m)',
  };
  return labels[metric] || metric;
}

export function getMetricUnit(metric: string): string {
  const units: Record<string, string> = {
    rainfall_mm: 'mm',
    temperature_c: '°C',
    humidity_pct: '%',
    river_level_m: 'm',
  };
  return units[metric] || '';
}

export function getMetricColor(metric: string): string {
  const colors: Record<string, string> = {
    rainfall_mm: '#2563EB',
    temperature_c: '#D97706',
    humidity_pct: '#0891B2',
    river_level_m: '#059669',
  };
  return colors[metric] || '#6366F1';
}

export function getCompletenessColor(pct: number): string {
  if (pct >= 95) return '#059669';
  if (pct >= 80) return '#D97706';
  return '#DC2626';
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
