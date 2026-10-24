import type { ExtremeRecord, NormalizedDataset, RiverRecord } from '../types/index.ts';
import { aggregateDaily, aggregateMonthly, aggregateYearly, calculateSummaryStats, dateBoundary, filterDailyRecords, metricCompleteness, qualityStatsFromAggregates, toTimeSeries, validateFilter } from './dataProcessing.ts';
import type { DataFilter, ObservationRange } from './dataProcessing.ts';

/** Injectable async repository; callers can keep this contract when REST replaces JSON. */
export function createDataService(load: () => Promise<NormalizedDataset>) {
  let cached: Promise<NormalizedDataset> | undefined;
  const dataset = () => cached ??= load().then(data => {
    if (!data.manifest?.schema_version || !Array.isArray(data.daily_records)) throw new Error('Dữ liệu chuẩn hóa không đúng cấu trúc. Hãy chạy npm run data:process.');
    if (data.manifest.quality_encoding === 'indexed-v1') {
      for (const record of data.daily_records) {
        if (record.quality_index === null) { record.quality = null; continue; }
        if (typeof record.quality_index !== 'number' || !Number.isInteger(record.quality_index) || record.quality_index < 0) {
          throw new Error('Chỉ số liên kết chất lượng trong dữ liệu chuẩn hóa không hợp lệ.');
        }
        const quality = data.quality_records[record.quality_index];
        if (!quality || quality.datetime !== record.datetime || quality.station_name !== record.station_name
          || quality.source_station_id !== record.source_station_id) throw new Error('Liên kết chất lượng trong dữ liệu chuẩn hóa không hợp lệ.');
        record.quality = quality;
      }
    }
    return data;
  }).catch(error => { cached = undefined; throw error; });
  async function context(filter: DataFilter = {}) {
    validateFilter(filter);
    const data = await dataset();
    const records = filterDailyRecords(data.daily_records, filter);
    const stations = data.stations.filter(s => (!filter.station_name || s.station_name === filter.station_name)
      && (filter.province_code == null || s.province_code === filter.province_code));
    let range: ObservationRange = { date_from: dateBoundary(filter.date_from) ?? data.manifest.date_range.from,
      date_to: dateBoundary(filter.date_to, true) ?? data.manifest.date_range.to,
      station_names: stations.map(s => s.station_name) };
    // A one-sided query wholly outside the source period is empty, not a reversed user range.
    if (range.date_from! > range.date_to!) range = { station_names: [] };
    return { data, records, stations, range };
  }
  const enrich = <T extends { station_name: string; province_code: number; completeness: Parameters<typeof metricCompleteness>[0]; completeness_pct: number }>(rows: T[], stations: NormalizedDataset['stations'], filter: DataFilter) => rows.map(row => ({
    ...row, province_code: stations.find(s => s.station_name === row.station_name)?.province_code ?? row.province_code,
    completeness_pct: metricCompleteness(row.completeness, filter.metric ?? 'rainfall_mm') ?? 0,
  }));

  async function getRiverRecords(filter: DataFilter = {}): Promise<RiverRecord[]> {
    validateFilter(filter);
    const data = await dataset();
    const from = dateBoundary(filter.date_from); const to = dateBoundary(filter.date_to, true);
    // Filter local civil dates in Vietnam; each timestamp retains its +07:00 offset.
    const start = from ? Date.parse(`${from}T00:00:00+07:00`) : -Infinity;
    const end = to ? Date.parse(`${to}T23:59:59.999+07:00`) : Infinity;
    return data.river_records.filter(r => (!filter.station_name || r.station_name === filter.station_name)
      && (filter.province_code == null || r.province_code === filter.province_code)
      && Date.parse(r.datetime) >= start && Date.parse(r.datetime) <= end)
      .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime) || a.station_name.localeCompare(b.station_name));
  }
  async function getMonthlyData(filter: DataFilter = {}) {
    const { records, stations, range } = await context(filter);
    return enrich(aggregateMonthly(records, range), stations, filter);
  }
  async function getYearlyData(filter: DataFilter = {}) {
    const { records, stations, range } = await context(filter);
    return enrich(aggregateYearly(records, range), stations, filter);
  }
  async function getTimeSeries(filter: DataFilter = {}) {
    if (filter.metric === 'river_level_m') return []; // Bulletins are not a continuous weather series.
    const resolution = filter.resolution ?? 'month';
    const { records, range } = await context(filter);
    const rows = resolution === 'day' ? aggregateDaily(records, range) : resolution === 'year' ? aggregateYearly(records, range) : aggregateMonthly(records, range);
    return toTimeSeries(rows, filter.metric ?? 'rainfall_mm', resolution);
  }
  return {
    getStations: async (filter: DataFilter = {}) => (await dataset()).stations.filter(station =>
      (!filter.station_name || station.station_name === filter.station_name)
      && (filter.province_code == null || station.province_code === filter.province_code)),
    getProvinces: async () => (await dataset()).provinces,
    getDescriptions: async () => (await dataset()).descriptions,
    getManifest: async () => (await dataset()).manifest,
    getMeteorologicalData: async (filter: DataFilter = {}) => (await context(filter)).records,
    getDailyData: async (filter: DataFilter = {}) => (await context(filter)).records,
    getMonthlyData, getYearlyData, getTimeSeries, getRiverRecords,
    getAggregatedData: async (filter: DataFilter = {}) => {
      if (filter.resolution === 'year') return getYearlyData(filter);
      if (filter.resolution !== 'day') return getMonthlyData(filter);
      const { records, stations, range } = await context(filter);
      return enrich(aggregateDaily(records, range), stations, filter);
    },
    getComparisonData: async (filter: DataFilter, stationNames: string[]) => Promise.all(stationNames.map(station_name => getTimeSeries({ ...filter, station_name }))),
    getSummaryStats: async (filter: DataFilter = {}) => {
      const { data, records, stations, range } = await context(filter);
      return calculateSummaryStats(records, { ...range, stations, provinces: data.provinces, river_records: (await getRiverRecords(filter)).length });
    },
    getQualityStats: async (filter: DataFilter = {}) => qualityStatsFromAggregates(await getYearlyData(filter)),
    getAnomalies: async (filter: DataFilter = {}) => {
      const { records } = await context(filter);
      return records.filter(r => {
        if (r.quality_status !== 'requires_review' && r.quality_status !== 'invalid' && r.quality_status !== 'unmatched') return false;
        if (!filter.metric) return true;
        const issues = (r.quality_issues ?? []).join(' ').toLowerCase();
        if (filter.metric === 'rainfall_mm') return (r.quality?.precip_reported_mm ?? r.rainfall_mm ?? 0) >= 500 || /rain|precip|mưa|quality|trạm|unmatched/.test(issues);
        if (filter.metric === 'temperature_c') return /temperature|nhiệt|quality|trạm|unmatched/.test(issues);
        if (filter.metric === 'humidity_pct') return /humidity|độ ẩm|quality|trạm|unmatched/.test(issues);
        return /river|mực nước/.test(issues);
      });
    },
    getExtremeRecords: async (filter: DataFilter = {}): Promise<ExtremeRecord[]> => {
      const { records } = await context(filter);
      if (filter.metric && filter.metric !== 'rainfall_mm') return [];
      return records.filter(r => (r.quality?.precip_reported_mm ?? r.rainfall_mm ?? 0) >= 500).map(r => ({
        datetime: r.datetime, station_name: r.station_name, province_code: r.province_code,
        precip_reported_mm: r.quality?.precip_reported_mm ?? r.rainfall_mm!, precip_flag: r.quality?.precip_flag ?? '',
        status: 'Cần kiểm chứng — giữ nguyên số liệu nguồn', source_url: r.source_url ?? '',
      }));
    },
  };
}

export const dataService = createDataService(async () => {
  const base = import.meta.env?.BASE_URL ?? '/';
  const response = await fetch(`${base}data/normalized_dataset.json`);
  if (!response.ok) throw new Error(`Không tải được dữ liệu (${response.status}). Hãy chạy npm run data:process.`);
  return response.json() as Promise<NormalizedDataset>;
});
