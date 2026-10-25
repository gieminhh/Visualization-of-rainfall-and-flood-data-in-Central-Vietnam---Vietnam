import type { MonthlyAggregate } from '../types/index.ts';

export type ResearchModel = 'Ridge' | 'Seasonal';
export interface MonthSample { date: string; index: number; value: number | null }
export interface Prediction { date: string; predicted: number; lower: number; upper: number }
export interface BacktestPoint { origin: string; date: string; lead: number; actual: number; predicted: number }
export const MODEL_NAMES = { Ridge: 'Ridge (hồi quy mùa vụ)', Seasonal: 'Trung bình cùng tháng' };
const monthLabel = (index: number) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;

/** Partial calendar months and incomplete rain totals are excluded, never filled. */
export function prepareMonths(rows: MonthlyAggregate[]): MonthSample[] {
  if (new Set(rows.map(row => row.station_name)).size > 1) throw new Error('Mỗi thí nghiệm chỉ dùng một trạm.');
  const samples = rows.map(row => {
    const days = new Date(Date.UTC(row.year, row.month, 0)).getUTCDate();
    const complete = row.expected_days === days && row.n_valid_rainfall === days;
    return { date: `${row.year}-${String(row.month).padStart(2, '0')}`, index: row.year * 12 + row.month - 1,
      value: complete && row.total_rainfall_mm !== null && Number.isFinite(row.total_rainfall_mm) ? row.total_rainfall_mm : null };
  }).sort((a, b) => a.index - b.index);
  if (new Set(samples.map(row => row.index)).size !== samples.length) throw new Error('Tháng bị trùng trong chuỗi huấn luyện.');
  if (!samples.length) return [];
  const byIndex = new Map(samples.map(row => [row.index, row]));
  return Array.from({ length: samples[samples.length - 1].index - samples[0].index + 1 }, (_, offset) => {
    const index = samples[0].index + offset;
    return byIndex.get(index) ?? { index, date: monthLabel(index), value: null };
  });
}

// Pivoted Gaussian elimination for the small, positive regularized normal system.
function solve(a: number[][], b: number[]) {
  const matrix = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < b.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < b.length; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    if (Math.abs(matrix[col][col]) < 1e-12) throw new Error('Không đủ dữ liệu để ước lượng hồi quy.');
    const divisor = matrix[col][col];
    for (let j = col; j <= b.length; j++) matrix[col][j] /= divisor;
    for (let row = 0; row < b.length; row++) if (row !== col) {
      const factor = matrix[row][col];
      for (let j = col; j <= b.length; j++) matrix[row][j] -= factor * matrix[col][j];
    }
  }
  return matrix.map(row => row[b.length]);
}

export function fitModel(samples: MonthSample[], model: ResearchModel): (index: number) => number {
  const valid = samples.filter((row): row is MonthSample & { value: number } => row.value !== null && Number.isFinite(row.value));
  if (valid.length < 24 || Array.from({ length: 12 }, (_, m) => valid.filter(row => row.index % 12 === m).length).some(n => n < 1)) {
    throw new Error('Cần ít nhất 24 tháng đủ ngày mưa hợp lệ, có đủ 12 tháng trong năm, trước mỗi mốc kiểm thử.');
  }
  if (model === 'Seasonal') return index => {
    const values = valid.filter(row => row.index % 12 === index % 12);
    return values.reduce((sum, row) => sum + row.value, 0) / values.length;
  };
  const start = valid[0].index;
  const features = (index: number) => [1, (index - start) / 120, ...[1, 2, 3].flatMap(k => [Math.sin(2 * Math.PI * k * index / 12), Math.cos(2 * Math.PI * k * index / 12)])];
  const size = features(start).length;
  const a = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i === j && i > 0 ? 1 : 0));
  const b = Array<number>(size).fill(0);
  for (const row of valid) {
    const x = features(row.index);
    for (let i = 0; i < size; i++) {
      b[i] += x[i] * row.value;
      for (let j = 0; j < size; j++) a[i][j] += x[i] * x[j];
    }
  }
  const weights = solve(a, b);
  return index => Math.max(0, features(index).reduce((sum, x, i) => sum + x * weights[i], 0));
}

export function score(points: BacktestPoint[]) {
  if (!points.length) throw new Error('Không có quan trắc hợp lệ để đánh giá.');
  const mean = points.reduce((sum, row) => sum + row.actual, 0) / points.length;
  const squaredError = points.reduce((sum, row) => sum + (row.predicted - row.actual) ** 2, 0);
  const variance = points.reduce((sum, row) => sum + (row.actual - mean) ** 2, 0);
  const nonZero = points.filter(row => row.actual !== 0);
  return { n: points.length, mae: points.reduce((sum, row) => sum + Math.abs(row.predicted - row.actual), 0) / points.length,
    rmse: Math.sqrt(squaredError / points.length),
    mape: nonZero.length ? nonZero.reduce((sum, row) => sum + Math.abs((row.predicted - row.actual) / row.actual), 0) / nonZero.length * 100 : null,
    mape_n: nonZero.length, r2: variance > 0 ? 1 - squaredError / variance : null };
}

export function runForecast(samples: MonthSample[], model: ResearchModel, horizon: number) {
  if (![1, 2, 3].includes(horizon)) throw new Error('Thời hạn dự báo phải từ 1 đến 3 tháng.');
  if (samples.filter(row => row.value !== null).length < 36) throw new Error('Cần ít nhất 36 tháng đủ ngày mưa hợp lệ để huấn luyện và kiểm thử. Không bù dữ liệu thiếu.');
  const last = samples[samples.length - 1];
  let points: BacktestPoint[] = [];
  const byIndex = new Map(samples.map(row => [row.index, row]));
  // Last twelve eligible origins with complete targets at every lead, keeping a common evaluation set.
  for (let origin = samples[0].index + 23; origin <= last.index - horizon; origin++) {
    if (Array.from({ length: horizon }, (_, i) => byIndex.get(origin + i + 1)?.value == null).some(Boolean)) continue;
    const train = samples.filter(row => row.index <= origin);
    let predict: (index: number) => number;
    try { predict = fitModel(train, model); } catch { continue; }
    for (let lead = 1; lead <= horizon; lead++) {
      const target = byIndex.get(origin + lead);
      if (target?.value == null) continue;
      points.push({ origin: monthLabel(origin), date: target.date, lead, actual: target.value, predicted: predict(target.index) });
    }
  }
  points = points.slice(-12 * horizon);
  const metricsByLead = Array.from({ length: horizon }, (_, i) => {
    const rows = points.filter(row => row.lead === i + 1);
    if (rows.length < 6) throw new Error(`Chỉ có ${rows.length} mẫu kiểm thử cho hạn ${i + 1} tháng; cần ít nhất 6. Hãy chọn trạm có chuỗi đầy đủ hơn.`);
    return { lead: i + 1, ...score(rows) };
  });
  const predict = fitModel(samples, model);
  const forecast: Prediction[] = Array.from({ length: horizon }, (_, i) => {
    const lead = i + 1;
    const residuals = points.filter(row => row.lead === lead).map(row => Math.abs(row.predicted - row.actual)).sort((a, b) => a - b);
    const width = residuals[Math.min(residuals.length - 1, Math.ceil(0.9 * residuals.length) - 1)];
    const predicted = predict(last.index + lead);
    return { date: monthLabel(last.index + lead), predicted, lower: Math.max(0, predicted - width), upper: predicted + width };
  });
  return { model, horizon, forecast, backtest: points, metrics: score(points), metricsByLead,
    trainFrom: samples[0].date, trainTo: last.date, lastValidMonth: samples.filter(row => row.value !== null).slice(-1)[0].date,
    validMonths: samples.filter(row => row.value !== null).length,
    excludedMonths: samples.filter(row => row.value === null).length, historical: samples.slice(-24),
    method: 'last-12-eligible-rolling-origins; ridge-alpha=1; trend+fourier-k=1,2,3; full-calendar-rain-months-only; interval=empirical-absolute-error-p90' };
}

export type ForecastResult = ReturnType<typeof runForecast>;
