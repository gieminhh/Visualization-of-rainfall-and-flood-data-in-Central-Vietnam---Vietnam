import type { Completeness, DailyRecord, DatasetStats, FilterState, MetricKey, MonthlyAggregate, NormalizedDataset, SummaryStats, TimeSeriesPoint, YearlyAggregate } from '../types/index.ts';

const DAY = 86400000;
export const METRICS: MetricKey[] = ['rainfall_mm', 'temperature_c', 'humidity_pct', 'river_level_m'];
export type DataFilter = Partial<FilterState>;
export interface ObservationRange { date_from?: string; date_to?: string; station_names?: string[] }

/** Accept calendar dates or whole years. Never convert UTC day labels to local time. */
export function dateBoundary(value: string | undefined, end = false): string | undefined {
  if (!value) return undefined;
  const date = /^\d{4}$/.test(value) ? `${value}-${end ? '12-31' : '01-01'}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Ngày không hợp lệ: ${value}`);
  }
  return date;
}

export function validateFilter(filter: DataFilter): void {
  const from = dateBoundary(filter.date_from);
  const to = dateBoundary(filter.date_to, true);
  if (from && to && from > to) throw new Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if (filter.metric && !METRICS.includes(filter.metric)) throw new Error('Chỉ số không hợp lệ.');
}

export function filterDailyRecords(records: DailyRecord[], filter: DataFilter = {}): DailyRecord[] {
  validateFilter(filter);
  const from = dateBoundary(filter.date_from);
  const to = dateBoundary(filter.date_to, true);
  // Metric selection must retain missing days, otherwise completeness becomes inflated.
  return records.filter(r => (!filter.station_name || r.station_name === filter.station_name)
    && (filter.province_code == null || r.province_code === filter.province_code)
    && (!from || r.datetime >= from) && (!to || r.datetime <= to))
    .sort((a, b) => a.datetime.localeCompare(b.datetime) || a.station_name.localeCompare(b.station_name));
}

export function validNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
export function sumValid(values: (number | null)[]): number | null {
  const valid = values.filter(validNumber);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) : null;
}
export function meanValid(values: (number | null)[]): number | null {
  const valid = values.filter(validNumber);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}
const round = (value: number | null) => value === null ? null : Math.round(value * 1000) / 1000;
const pct = (count: number, expected: number) => expected ? Math.round(count / expected * 10000) / 100 : null;
const daysBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1);
const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
function extent(records: DailyRecord[]) {
  let from = ''; let to = '';
  for (const r of records) { if (!from || r.datetime < from) from = r.datetime; if (r.datetime > to) to = r.datetime; }
  return { from, to };
}

/** Denominator is calendar days × selected stations, not number of existing rows. */
export function calculateCompleteness(records: DailyRecord[], range: ObservationRange = {}): Completeness {
  const observed = extent(records);
  const from = dateBoundary(range.date_from) ?? observed.from;
  const to = dateBoundary(range.date_to, true) ?? observed.to;
  if (from && to && from > to) throw new Error('Khoảng quan trắc không hợp lệ.');
  const stations = new Set(range.station_names ?? records.map(r => r.station_name));
  const expected = from && to ? daysBetween(from, to) * stations.size : 0;
  const selected = records.filter(r => stations.has(r.station_name) && r.datetime >= from && r.datetime <= to);
  const count = (metric?: MetricKey) => new Set(selected.filter(r => !metric || validNumber(r[metric])).map(r => `${r.station_name}\0${r.datetime}`)).size;
  const recorded = count(); const rainfall = count('rainfall_mm'); const temperature = count('temperature_c');
  const humidity = count('humidity_pct'); const river = count('river_level_m');
  return { expected_days: expected, recorded_days: recorded, valid_rainfall_days: rainfall, valid_temperature_days: temperature,
    valid_humidity_days: humidity, valid_river_level_days: river, record_completeness_pct: pct(recorded, expected),
    rainfall_completeness_pct: pct(rainfall, expected), temperature_completeness_pct: pct(temperature, expected),
    humidity_completeness_pct: pct(humidity, expected), river_level_completeness_pct: pct(river, expected) };
}

export function metricCompleteness(completeness: Completeness, metric: MetricKey): number | null {
  return metric === 'rainfall_mm' ? completeness.rainfall_completeness_pct : metric === 'temperature_c'
    ? completeness.temperature_completeness_pct : metric === 'humidity_pct' ? completeness.humidity_completeness_pct : completeness.river_level_completeness_pct;
}

export interface AggregateRow extends MonthlyAggregate {
  datetime: string;
  avg_river_level_m: number | null;
  max_daily_rainfall: number | null;
  completeness: Completeness;
  period_start: string;
  period_end: string;
  expected_days: number;
  recorded_days: number;
  warnings: string[];
  sources: string[];
  quality_statuses: string[];
  quality_issues: string[];
}

function aggregate(records: DailyRecord[], resolution: 'day' | 'month' | 'year', range: ObservationRange = {}): AggregateRow[] {
  const observed = extent(records);
  const defaultFrom = !observed.from || resolution === 'day' ? observed.from
    : resolution === 'month' ? `${observed.from.slice(0, 7)}-01` : `${observed.from.slice(0, 4)}-01-01`;
  const defaultTo = !observed.to || resolution === 'day' ? observed.to
    : resolution === 'month' ? new Date(Date.UTC(Number(observed.to.slice(0, 4)), Number(observed.to.slice(5, 7)), 0)).toISOString().slice(0, 10)
    : `${observed.to.slice(0, 4)}-12-31`;
  const from = dateBoundary(range.date_from) ?? defaultFrom;
  const to = dateBoundary(range.date_to, true) ?? defaultTo;
  if (!from || !to) return [];
  if (from > to) throw new Error('Khoảng tổng hợp không hợp lệ.');
  const stationNames = [...new Set(range.station_names ?? records.map(r => r.station_name))];
  const periodKey = (date: string) => date.slice(0, resolution === 'day' ? 10 : resolution === 'month' ? 7 : 4);
  const groups = new Map<string, DailyRecord[]>();
  const province = new Map<string, number>();
  for (const record of records) {
    province.set(record.station_name, record.province_code);
    if (record.datetime < from || record.datetime > to) continue;
    const key = `${record.station_name}\0${periodKey(record.datetime)}`;
    const group = groups.get(key) ?? []; group.push(record); groups.set(key, group);
  }
  const periods: { key: string; start: string; end: string }[] = [];
  let date = from;
  while (date <= to) {
    const key = periodKey(date);
    const year = Number(date.slice(0, 4)); const month = Number(date.slice(5, 7));
    const start = resolution === 'day' ? date : resolution === 'month' ? `${key}-01` : `${key}-01-01`;
    const end = resolution === 'day' ? date : resolution === 'month' ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) : `${key}-12-31`;
    periods.push({ key, start: start < from ? from : start, end: end > to ? to : end });
    date = nextDay(end);
  }
  const result: AggregateRow[] = [];
  for (const period of periods) for (const station of stationNames) {
    const rows = groups.get(`${station}\0${period.key}`) ?? [];
    const completeness = calculateCompleteness(rows, { date_from: period.start, date_to: period.end, station_names: [station] });
    const rainfall = rows.map(r => r.rainfall_mm).filter(validNumber);
    const warnings: string[] = [];
    if (completeness.recorded_days < completeness.expected_days) warnings.push(`Thiếu ${completeness.expected_days - completeness.recorded_days} ngày có bản ghi trong kỳ.`);
    if (completeness.valid_rainfall_days < completeness.expected_days) warnings.push('Tổng mưa chỉ gồm ngày có giá trị hợp lệ; chưa phải tổng đầy đủ của kỳ.');
    if (rows.some(r => r.quality_status === 'requires_review')) warnings.push('Có số liệu nguồn cần kiểm chứng; chưa được xác thực.');
    result.push({ datetime: period.start, year: Number(period.key.slice(0, 4)), month: Number(period.start.slice(5, 7)), station_name: station,
      province_code: province.get(station) ?? 0, avg_rainfall_mm: round(meanValid(rows.map(r => r.rainfall_mm))),
      total_rainfall_mm: round(sumValid(rows.map(r => r.rainfall_mm))), avg_temperature_c: round(meanValid(rows.map(r => r.temperature_c))),
      avg_humidity_pct: round(meanValid(rows.map(r => r.humidity_pct))), avg_river_level_m: round(meanValid(rows.map(r => r.river_level_m))),
      max_daily_rainfall: rainfall.length ? Math.max(...rainfall) : null, n_records: rows.length,
      n_valid_rainfall: completeness.valid_rainfall_days, n_valid_temperature: completeness.valid_temperature_days,
      n_valid_humidity: completeness.valid_humidity_days, completeness_pct: completeness.rainfall_completeness_pct ?? 0,
      completeness, period_start: period.start, period_end: period.end, expected_days: completeness.expected_days, recorded_days: completeness.recorded_days,
      warnings, sources: [...new Set(rows.flatMap(r => [r.source_file, r.source_url].filter((s): s is string => Boolean(s))))],
      quality_statuses: [...new Set(rows.map(r => r.quality_status ?? 'unmatched'))],
      quality_issues: [...new Set(rows.flatMap(r => r.quality_issues ?? []))] });
  }
  return result;
}

export const aggregateDaily = (records: DailyRecord[], range: ObservationRange = {}) => aggregate(records, 'day', range);
export const aggregateMonthly = (records: DailyRecord[], range: ObservationRange = {}) => aggregate(records, 'month', range);
export function aggregateYearly(records: DailyRecord[], range: ObservationRange = {}): (AggregateRow & YearlyAggregate)[] {
  return aggregate(records, 'year', range).map(row => {
    const calendarDays = daysBetween(`${row.year}-01-01`, `${row.year}-12-31`);
    const partial = row.expected_days < calendarDays || row.recorded_days < calendarDays;
    const complete = !partial && row.completeness.valid_rainfall_days === calendarDays
      && row.completeness.valid_temperature_days === calendarDays && row.completeness.valid_humidity_days === calendarDays;
    return { ...row, is_partial_year: partial, is_complete_year: complete,
      warnings: [...row.warnings, ...(partial ? ['Năm chưa đầy đủ: phạm vi quan trắc hoặc bộ lọc không bao phủ đủ ngày trong năm.'] : []),
        ...(!complete && !partial ? ['Năm có bản ghi đủ ngày nhưng một số chỉ số còn thiếu.'] : [])] };
  });
}

export function qualityStatsFromAggregates(rows: (AggregateRow & YearlyAggregate)[]): DatasetStats[] {
  return rows.map(r => ({ station_name: r.station_name, province_code: r.province_code, year: r.year,
    total_days: r.recorded_days, expected_days: r.expected_days, recorded_days: r.recorded_days,
    valid_rainfall: r.completeness.valid_rainfall_days, valid_temperature: r.completeness.valid_temperature_days, valid_humidity: r.completeness.valid_humidity_days,
    missing_rainfall: r.expected_days - r.completeness.valid_rainfall_days,
    missing_temperature: r.expected_days - r.completeness.valid_temperature_days, missing_humidity: r.expected_days - r.completeness.valid_humidity_days,
    completeness_rainfall_pct: r.completeness.rainfall_completeness_pct ?? 0,
    completeness_temperature_pct: r.completeness.temperature_completeness_pct ?? 0,
    completeness_humidity_pct: r.completeness.humidity_completeness_pct ?? 0,
    completeness_records_pct: r.completeness.record_completeness_pct ?? 0 }));
}

export function calculateSummaryStats(records: DailyRecord[], options: ObservationRange & { stations?: NormalizedDataset['stations']; provinces?: NormalizedDataset['provinces']; river_records?: number } = {}): SummaryStats {
  const observed = extent(records);
  return { total_records: records.length, total_stations: options.stations?.length ?? new Set(records.map(r => r.station_name)).size,
    stations_with_daily_data: new Set(records.map(r => r.station_name)).size, date_from: observed.from, date_to: observed.to,
    provinces_covered: new Set(records.map(r => r.province_code)).size, provinces_total: options.provinces?.length ?? new Set(records.map(r => r.province_code)).size,
    river_records: options.river_records ?? 0, completeness: calculateCompleteness(records, options),
    data_note: 'Số liệu theo nguồn CSV; độ đầy đủ không đồng nghĩa đã kiểm chứng. Ngày khí tượng theo UTC; bản tin mực nước là quan trắc rời rạc theo giờ Việt Nam.' };
}

export function aggregateValue(row: AggregateRow, metric: MetricKey): number | null {
  return metric === 'rainfall_mm' ? row.total_rainfall_mm : metric === 'temperature_c' ? row.avg_temperature_c : metric === 'humidity_pct' ? row.avg_humidity_pct : row.avg_river_level_m;
}
export function toTimeSeries(rows: AggregateRow[], metric: MetricKey, resolution: 'day' | 'month' | 'year'): TimeSeriesPoint[] {
  return rows.map(r => ({ date: r.datetime, label: resolution === 'year' ? String(r.year) : resolution === 'month' ? `${String(r.month).padStart(2, '0')}/${r.year}` : r.datetime,
    station_name: r.station_name, value: aggregateValue(r, metric) }));
}
