import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Map, GitCompare, TrendingUp, RotateCcw, Play, Search, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { Card, SectionHeader, Select, Button, Tabs, Badge, EmptyState } from '../components/ui';
import { MonthlyBarChart, TimeSeriesChart, YearlyLineChart, ComparisonLineChart, CompletenessHeatmap } from '../components/charts';
import StationMap from '../components/maps/StationMap';
import { dataService } from '../services/dataService';
import type { MetricKey, Resolution, FilterState, Station, Province, RiverRecord, MonthlyAggregate, YearlyAggregate, DatasetStats } from '../types';
import { getMetricLabel, computeStats, getMetricUnit } from '../utils';

type TimePoint = { date: string; label: string; station_name: string; value: number | null };
type Summary = Awaited<ReturnType<typeof dataService.getSummaryStats>>;
type Extreme = Awaited<ReturnType<typeof dataService.getExtremeRecords>>[number];
type Daily = Awaited<ReturnType<typeof dataService.getDailyData>>[number];
const RESOLUTION_LABELS: Record<Resolution, string> = { day: 'ngày', month: 'tháng', year: 'năm' };
const DEFAULT_FILTER: FilterState = { province_code: null, station_name: 'Phú Bài', date_from: '', date_to: '', metric: 'rainfall_mm', resolution: 'month' };

function dateInput(value: string, end = false): string {
  return /^\d{4}$/.test(value) ? `${value}-${end ? '12-31' : '01-01'}` : value.slice(0, 10);
}

function FilterBar({ filter, stations, provinces, rivers, onChange, onApply, onReset }: {
  filter: FilterState; stations: Station[]; provinces: Province[]; rivers: RiverRecord[];
  onChange: (filter: FilterState) => void; onApply: () => void; onReset: () => void;
}) {
  const sourceStations = filter.metric === 'river_level_m' ? rivers : stations;
  const stationNames = [...new Set(sourceStations.filter(station => !filter.province_code || station.province_code === filter.province_code).map(station => station.station_name))];
  const invalidDates = !filter.date_from || !filter.date_to || filter.date_from > filter.date_to;
  return <Card className="p-4">
    <div className="flex items-end gap-3 flex-wrap">
      <Select label="Tỉnh/thành phố" value={filter.province_code ? String(filter.province_code) : ''}
        onChange={value => onChange({ ...filter, province_code: value ? Number(value) : null, station_name: null })}
        options={[{ value: '', label: 'Tất cả tỉnh/thành' }, ...provinces.map(province => ({ value: String(province.province_code), label: province.province_name }))]} className="min-w-[160px]" />
      <Select label="Trạm quan trắc" value={filter.station_name || ''} onChange={value => onChange({ ...filter, station_name: value || null })}
        options={[{ value: '', label: filter.province_code ? 'Tất cả trạm trong tỉnh' : 'Tất cả trạm' }, ...stationNames.map(name => ({ value: name, label: name }))]} className="min-w-[140px]" />
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Từ ngày
        <input aria-label="Từ ngày" type="date" value={filter.date_from} onChange={event => onChange({ ...filter, date_from: event.target.value })}
          className="text-sm text-slate-700 rounded-lg px-2 py-2 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-200" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Đến ngày
        <input aria-label="Đến ngày" type="date" value={filter.date_to} onChange={event => onChange({ ...filter, date_to: event.target.value })}
          className="text-sm text-slate-700 rounded-lg px-2 py-2 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-200" />
      </label>
      <Select label="Chỉ số" value={filter.metric}
        onChange={value => onChange({ ...filter, metric: value as MetricKey, station_name: (value === 'river_level_m') !== (filter.metric === 'river_level_m') ? null : filter.station_name })}
        options={[{ value: 'rainfall_mm', label: 'Lượng mưa (mm)' }, { value: 'temperature_c', label: 'Nhiệt độ (°C)' }, { value: 'humidity_pct', label: 'Độ ẩm (%)' }, { value: 'river_level_m', label: 'Mực nước bản tin (m)' }]} className="min-w-[160px]" />
      <Select label="Độ phân giải" value={filter.resolution} onChange={value => onChange({ ...filter, resolution: value as Resolution })}
        options={[{ value: 'day', label: 'Theo ngày' }, { value: 'month', label: 'Theo tháng' }, { value: 'year', label: 'Theo năm' }]} className="min-w-[130px]" />
      <div className="flex items-center gap-2 mt-4">
        <Button variant="primary" onClick={onApply} disabled={invalidDates}><Play size={13} /> Áp dụng</Button>
        <Button variant="ghost" onClick={onReset}><RotateCcw size={13} /> Đặt lại</Button>
      </div>
    </div>
    {invalidDates && <p role="alert" className="text-xs text-amber-700 mt-2">Chọn khoảng ngày hợp lệ; ngày bắt đầu không được sau ngày kết thúc.</p>}
  </Card>;
}

interface TableRow {
  date: string; station_name: string; rainfall: number | null; temperature: number | null;
  humidity: number | null; completeness: number | null; note: string; source: string;
}

function aggregateCompleteness(row: MonthlyAggregate | YearlyAggregate, metric: MetricKey): number | null {
  if (metric === 'river_level_m') return null;
  return metric === 'rainfall_mm' ? row.completeness.rainfall_completeness_pct
    : metric === 'temperature_c' ? row.completeness.temperature_completeness_pct : row.completeness.humidity_completeness_pct;
}

function buildTableRows(daily: Daily[], monthly: MonthlyAggregate[], yearly: YearlyAggregate[], filter: FilterState): TableRow[] {
  if (filter.resolution === 'day') return daily.map(row => ({
    date: row.datetime.slice(0, 10), station_name: row.station_name, rainfall: row.rainfall_mm,
    temperature: row.temperature_c, humidity: row.humidity_pct, completeness: null,
    note: [row.quality_status === 'requires_review' ? 'Cần kiểm chứng' : row.quality_status === 'invalid' ? 'Có giá trị không hợp lệ' : row.quality_status === 'unmatched' ? 'Chưa ghép được bản ghi chất lượng' : '',
      filter.metric === 'rainfall_mm' ? row.quality?.precip_status : filter.metric === 'humidity_pct' ? row.quality?.humidity_status : row.quality?.temperature_n_obs == null ? '' : `${row.quality.temperature_n_obs} quan trắc nhiệt độ`,
      ...(row.quality_issues ?? []),
    ].filter(Boolean).join(' · '), source: row.source_url ?? '',
  }));
  const rows = filter.resolution === 'month' ? monthly : yearly;
  return rows.map(row => ({
    date: filter.resolution === 'month' ? `${row.year}-${String((row as MonthlyAggregate).month).padStart(2, '0')}` : String(row.year),
    station_name: row.station_name, rainfall: row.total_rainfall_mm, temperature: row.avg_temperature_c,
    humidity: row.avg_humidity_pct, completeness: aggregateCompleteness(row, filter.metric), note: row.warnings.join(' '), source: '',
  }));
}

function DataTable({ data, resolution, metric }: { data: TableRow[]; resolution: Resolution; metric: MetricKey }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<keyof TableRow>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [data]);
  const filtered = data.filter(row => row.station_name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    const order = av === bv ? a.station_name.localeCompare(b.station_name, 'vi') : av > bv ? 1 : -1;
    return sortAsc ? order : -order;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / 12));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * 12, currentPage * 12);
  const columns: { key: keyof TableRow; label: string }[] = [
    { key: 'date', label: `Thời gian (${RESOLUTION_LABELS[resolution]})` }, { key: 'station_name', label: 'Trạm' },
    { key: 'rainfall', label: resolution === 'day' ? 'Mưa ngày (mm)' : 'Tổng mưa (mm)' },
    { key: 'temperature', label: 'Nhiệt độ TB (°C)' }, { key: 'humidity', label: 'Độ ẩm TB (%)' },
    { key: 'completeness', label: `Đầy đủ: ${getMetricLabel(metric)}` }, { key: 'note', label: 'Ghi chú chất lượng' },
  ];
  return <div>
    <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2">
      <div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input aria-label="Tìm theo tên trạm" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên trạm..." className="text-xs pl-7 pr-3 py-2 rounded-lg border border-slate-200 outline-none w-[200px]" />
      </div><span className="text-xs text-slate-500">{filtered.length.toLocaleString('vi-VN')} bản ghi {RESOLUTION_LABELS[resolution]}</span>
    </div><span className="text-xs text-slate-400">Nguồn: Dataset_ngay.csv</span></div>
    <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs">
      <thead className="bg-slate-50"><tr>{columns.map(column => <th key={column.key} className="text-left px-3 py-2.5 font-semibold border-b border-slate-200 whitespace-nowrap text-slate-600">
        {column.label}<button aria-label={`Sắp xếp ${column.label}`} className="inline-flex ml-1" onClick={() => { setSortCol(column.key); setSortAsc(sortCol === column.key ? !sortAsc : true); }}>
          {sortCol === column.key && sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button></th>)}</tr></thead>
      <tbody>{paged.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-slate-400">Không tìm thấy bản ghi phù hợp</td></tr> : paged.map(row => <tr key={`${row.station_name}-${row.date}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td className="px-3 py-2 font-mono text-slate-600">{row.date}</td><td className="px-3 py-2 font-medium text-slate-800">{row.station_name}</td>
        {[row.rainfall, row.temperature, row.humidity].map((value, index) => <td key={index} className="px-3 py-2 font-mono text-slate-700">{value === null ? 'Không có dữ liệu' : value.toFixed(1)}</td>)}
        <td className="px-3 py-2 font-medium" style={{ color: row.completeness === null ? '#94A3B8' : row.completeness >= 90 ? '#059669' : row.completeness >= 70 ? '#D97706' : '#DC2626' }}>{row.completeness === null ? '—' : `${row.completeness.toFixed(1)}%`}</td>
        <td className="px-3 py-2 text-slate-500 min-w-[160px]">{row.note || '—'}{row.source && <a href={row.source} className="block text-blue-600 underline" target="_blank" rel="noreferrer">Nguồn quan trắc</a>}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="flex items-center justify-between mt-2"><span className="text-xs text-slate-400">Trang {currentPage}/{totalPages} · {filtered.length} bản ghi</span>
      <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>‹ Trước</Button>
        <Button size="sm" variant="ghost" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Sau ›</Button></div>
    </div>
  </div>;
}

function ComparisonStatsTable({ labelA, labelB, valuesA, valuesB, metric, resolution }: {
  labelA: string; labelB: string; valuesA: (number | null)[]; valuesB: (number | null)[]; metric: MetricKey; resolution: Resolution;
}) {
  const statsA = computeStats(valuesA), statsB = computeStats(valuesB);
  const rows = [
    { label: 'Giá trị trung bình (Mean)', a: statsA.mean, b: statsB.mean }, { label: 'Trung vị (Median)', a: statsA.median, b: statsB.median },
    { label: 'Độ lệch chuẩn (Std Dev)', a: statsA.stdDev, b: statsB.stdDev }, { label: 'Giá trị lớn nhất (Max)', a: statsA.max, b: statsB.max },
    { label: 'Giá trị nhỏ nhất (Min)', a: statsA.min, b: statsB.min },
    { label: `Số ${RESOLUTION_LABELS[resolution]} có dữ liệu`, a: statsA.count, b: statsB.count, noUnit: true },
  ];
  return <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs">
    <thead className="bg-slate-50"><tr><th className="text-left px-4 py-2.5 font-semibold text-slate-600">Chỉ số thống kê</th>
      <th className="text-center px-4 py-2.5 font-semibold text-blue-600">{labelA}</th><th className="text-center px-4 py-2.5 font-semibold text-cyan-600">{labelB}</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.label} className="border-t border-slate-100"><td className="px-4 py-2 font-medium text-slate-600">{row.label}</td>
      {[row.a, row.b].map((value, index) => <td key={index} className="px-4 py-2 text-center font-medium font-mono text-slate-800">{value === null ? 'Không có dữ liệu' : `${value}${row.noUnit ? '' : ` ${getMetricUnit(metric)}`}`}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

function RiverBulletins({ records }: { records: RiverRecord[] }) {
  return <div className="space-y-4">
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Mực nước là các ghi nhận rời rạc từ bản tin thủy văn. Không nội suy, cộng hoặc trung bình thành chuỗi ngày/tháng/năm; thời điểm và múi giờ được giữ theo nguồn.</div>
    {records.length === 0 ? <EmptyState title="Không có bản tin phù hợp" description="Không có quan trắc mực nước trong phạm vi trạm, tỉnh và ngày đã chọn." icon="💧" /> :
      <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs">
        <thead className="bg-slate-50"><tr>{['Thời điểm nguồn', 'Múi giờ', 'Trạm / Sông', 'Mực nước (m)', 'Mốc cao độ / Loại quan trắc', 'Chất lượng / Nguồn'].map(label => <th key={label} className="p-3 text-left text-slate-600">{label}</th>)}</tr></thead>
        <tbody>{records.map((record, index) => <tr key={`${record.station_name}-${record.datetime}-${index}`} className="border-t border-slate-100">
          <td className="p-3 font-mono whitespace-nowrap">{record.original_datetime || record.datetime}</td><td className="p-3">{record.timezone}</td><td className="p-3">{record.station_name}<div className="text-slate-400">{record.river_name}</div></td>
          <td className="p-3 font-mono">{record.river_level_m === null ? 'Không có dữ liệu' : record.river_level_m.toFixed(2)}</td><td className="p-3">{record.water_level_datum || 'Chưa rõ mốc cao độ'}<div className="text-slate-400">{record.observation_type}</div></td>
          <td className="p-3"><div>{record.quality_note}</div>{record.source_url && <a className="text-blue-600 underline" href={record.source_url} target="_blank" rel="noreferrer">Bản tin gốc</a>}</td>
        </tr>)}</tbody>
      </table></div>}
  </div>;
}

export default function AnalysisPage() {
  const location = useLocation();
  const passedFilter = useMemo(() => (location.state as { filter?: Partial<FilterState> } | null)?.filter, [location.state]);
  const [filter, setFilter] = useState<FilterState>({ ...DEFAULT_FILTER, ...passedFilter });
  const [appliedFilter, setAppliedFilter] = useState<FilterState>({ ...DEFAULT_FILTER, ...passedFilter });
  const [tab, setTab] = useState('explore');
  const [stations, setStations] = useState<Station[]>([]), [provinces, setProvinces] = useState<Province[]>([]);
  const [allRivers, setAllRivers] = useState<RiverRecord[]>([]), [summary, setSummary] = useState<Summary | null>(null);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(2020);
  const [compareA, setCompareA] = useState('Phú Bài'), [compareB, setCompareB] = useState('Vinh');
  const [compareDataA, setCompareDataA] = useState<TimePoint[]>([]), [compareDataB, setCompareDataB] = useState<TimePoint[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false), [comparisonError, setComparisonError] = useState('');
  const [comparisonWarnings, setComparisonWarnings] = useState<string[]>([]);
  const [dailyData, setDailyData] = useState<Daily[]>([]), [monthlyData, setMonthlyData] = useState<MonthlyAggregate[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyAggregate[]>([]), [quality, setQuality] = useState<DatasetStats[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimePoint[]>([]), [extremes, setExtremes] = useState<Extreme[]>([]), [rivers, setRivers] = useState<RiverRecord[]>([]);

  useEffect(() => {
    let active = true;
    setReady(false); setLoading(true);
    Promise.all([dataService.getStations(), dataService.getProvinces(), dataService.getSummaryStats(), dataService.getRiverRecords()])
      .then(([nextStations, nextProvinces, nextSummary, nextRivers]) => {
        if (!active) return;
        setStations(nextStations); setProvinces(nextProvinces); setSummary(nextSummary); setAllRivers(nextRivers);
        const nextFilter = { ...DEFAULT_FILTER, ...passedFilter, date_from: dateInput(passedFilter?.date_from || nextSummary.date_from), date_to: dateInput(passedFilter?.date_to || nextSummary.date_to, true) };
        setFilter(nextFilter); setAppliedFilter(nextFilter); setReady(true);
      }).catch(reason => { if (active) { setError(String(reason)); setLoading(false); } });
    return () => { active = false; };
  }, [passedFilter]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true); setError('');
    Promise.all([dataService.getDailyData(appliedFilter), dataService.getMonthlyData(appliedFilter), dataService.getYearlyData(appliedFilter), dataService.getQualityStats(appliedFilter), dataService.getTimeSeries(appliedFilter), dataService.getExtremeRecords(appliedFilter), dataService.getRiverRecords(appliedFilter)])
      .then(([daily, monthly, yearly, qualityStats, points, extremeRecords, riverRecords]) => {
        if (!active) return;
        setDailyData(daily); setMonthlyData(monthly); setYearlyData(yearly); setQuality(qualityStats); setTimeSeries(points); setExtremes(extremeRecords); setRivers(riverRecords); setLoading(false);
      }).catch(reason => { if (active) { setError(String(reason)); setLoading(false); } });
    return () => { active = false; };
  }, [ready, appliedFilter]);

  const comparisonStations = useMemo(() => stations.filter(station => station.n_rows > 0 && (!appliedFilter.province_code || station.province_code === appliedFilter.province_code)), [stations, appliedFilter.province_code]);
  useEffect(() => {
    if (!ready) return;
    const names = comparisonStations.map(station => station.station_name);
    if (!names.includes(compareA)) setCompareA(names[0] || '');
    if (!names.includes(compareB)) setCompareB(names[1] || names[0] || '');
  }, [ready, comparisonStations, compareA, compareB]);
  useEffect(() => {
    if (!ready || appliedFilter.metric === 'river_level_m') return;
    let active = true;
    setComparisonLoading(true); setComparisonError('');
    Promise.all([
      compareA ? dataService.getTimeSeries({ ...appliedFilter, station_name: compareA }) : Promise.resolve([]),
      compareB ? dataService.getTimeSeries({ ...appliedFilter, station_name: compareB }) : Promise.resolve([]),
      compareA ? dataService.getYearlyData({ ...appliedFilter, station_name: compareA }) : Promise.resolve([]),
      compareB ? dataService.getYearlyData({ ...appliedFilter, station_name: compareB }) : Promise.resolve([]),
    ]).then(([a, b, yearsA, yearsB]) => { if (active) {
      setCompareDataA(a); setCompareDataB(b);
      setComparisonWarnings([...new Set([...yearsA, ...yearsB].flatMap(row => row.warnings.map(warning => `${row.station_name} ${row.year}: ${warning}`)))]);
      setComparisonLoading(false);
    } }).catch(reason => { if (active) { setCompareDataA([]); setCompareDataB([]); setComparisonWarnings([]); setComparisonError(String(reason)); setComparisonLoading(false); } });
    return () => { active = false; };
  }, [ready, appliedFilter, compareA, compareB]);

  const yearOptions = useMemo(() => [...new Set(monthlyData.map(row => row.year))].sort((a, b) => a - b), [monthlyData]);
  const chartYear = selectedYear !== null && yearOptions.includes(selectedYear) ? selectedYear : yearOptions[0];
  const tableRows = useMemo(() => buildTableRows(dailyData, monthlyData, yearlyData, appliedFilter), [dailyData, monthlyData, yearlyData, appliedFilter]);
  const warnings = useMemo(() => [...new Set(yearlyData.flatMap(row => row.warnings.map(warning => `${row.station_name} ${row.year}: ${warning}`)))], [yearlyData]);
  const visibleWarnings = tab === 'compare' ? comparisonWarnings : warnings;
  const scopedStations = useMemo(() => stations.filter(station => (!appliedFilter.province_code || station.province_code === appliedFilter.province_code) && (!appliedFilter.station_name || station.station_name === appliedFilter.station_name)), [stations, appliedFilter]);
  const mapStations = useMemo(() => stations.filter(station => !appliedFilter.province_code || station.province_code === appliedFilter.province_code), [stations, appliedFilter.province_code]);
  const heatmapStations = [...new Set(quality.map(row => row.station_name))], heatmapYears = [...new Set(quality.map(row => row.year))].sort((a, b) => a - b);
  const stationOptions = comparisonStations.map(station => ({ value: station.station_name, label: station.station_name }));
  const hasSeries = timeSeries.some(point => point.value !== null), hasComparison = compareDataA.some(point => point.value !== null) || compareDataB.some(point => point.value !== null);
  const monthlyHasValues = monthlyData.some(row => row.year === chartYear && (appliedFilter.metric === 'rainfall_mm' ? row.total_rainfall_mm : appliedFilter.metric === 'temperature_c' ? row.avg_temperature_c : row.avg_humidity_pct) !== null);
  const isRiver = appliedFilter.metric === 'river_level_m';
  const getQualityValue = (station: string, year: number): number | null => {
    const record = quality.find(row => row.station_name === station && row.year === year);
    if (!record) return null;
    return appliedFilter.metric === 'rainfall_mm' ? record.completeness_rainfall_pct : appliedFilter.metric === 'temperature_c' ? record.completeness_temperature_pct : record.completeness_humidity_pct;
  };
  const reset = () => {
    if (!summary) return;
    const resetFilter = { ...DEFAULT_FILTER, date_from: dateInput(summary.date_from), date_to: dateInput(summary.date_to, true) };
    setFilter(resetFilter); setAppliedFilter(resetFilter); setSelectedYear(null);
  };
  const mapSelect = (name: string | null) => {
    const next = { ...appliedFilter, station_name: name };
    setFilter(next); setAppliedFilter(next);
  };
  const empty = <EmptyState title="Không có dữ liệu phù hợp" description="Không có giá trị hợp lệ cho chỉ số, trạm và khoảng thời gian đã chọn." icon="📊" />;

  return <div className="space-y-4 max-w-[1400px]">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold" style={{ color: '#12304A' }}>Không gian phân tích</h1>
      <p className="text-sm mt-0.5 text-slate-500">Không gian làm việc nghiên cứu chuyên sâu (Research Workspace) · {summary ? `${dateInput(summary.date_from)} → ${dateInput(summary.date_to)}` : 'Đang tải phạm vi dữ liệu'}</p></div>
      <div className="flex items-center gap-2"><Badge color="green">{summary ? `${summary.total_records.toLocaleString('vi-VN')} bản ghi nguồn` : 'Đang tải'}</Badge><span className="text-xs text-slate-500">SSODv2 / GSOD</span></div>
    </div>
    <FilterBar filter={filter} stations={stations} provinces={provinces} rivers={allRivers} onChange={setFilter} onApply={() => setAppliedFilter({ ...filter })} onReset={reset} />
    {error && <Card className="p-4"><EmptyState title="Không thể tải dữ liệu" description={error} icon="⚠️" /></Card>}
    {!loading && !error && !isRiver && !(tab === 'compare' && comparisonLoading) && visibleWarnings.length > 0 && <div role="status" className="rounded-lg px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Có kỳ quan sát chưa đầy đủ; không so sánh tổng mưa của kỳ thiếu với kỳ đầy đủ.</div>
      <details className="mt-1"><summary className="cursor-pointer">Xem {visibleWarnings.length} cảnh báo theo trạm và năm</summary><ul className="mt-2 space-y-1">{visibleWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>
    </div>}
    <Card className="overflow-hidden"><div className="px-4 pt-4 border-b border-slate-200"><Tabs activeTab={tab} onChange={setTab} tabs={[
      { id: 'explore', label: 'Tab A: Khám phá dữ liệu', icon: <Map size={14} /> }, { id: 'compare', label: 'Tab B: So sánh đối sánh (Split View)', icon: <GitCompare size={14} /> },
      { id: 'advanced', label: 'Tab C: Phân tích chuyên sâu & Mưa cực đoan', icon: <TrendingUp size={14} /> },
    ]} /></div>
      <div className="p-4">{loading ? <div role="status" className="py-16 text-center text-sm text-slate-500">Đang tải dữ liệu quan trắc…</div> : error ? empty : isRiver ? <RiverBulletins records={rivers} /> : <>
        {tab === 'explore' && <div className="space-y-5">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2"><div className="text-xs font-semibold mb-2 text-slate-600">Vị trí trạm quan trắc (chọn để cập nhật bộ lọc)</div>
              <StationMap stations={mapStations} selectedStation={appliedFilter.station_name} onSelectStation={mapSelect} height="320px" />
            </div>
            <div className="col-span-3"><div className="flex items-center justify-between mb-2"><div className="text-xs font-semibold text-slate-600">Diễn biến theo {RESOLUTION_LABELS[appliedFilter.resolution]}: {getMetricLabel(appliedFilter.metric)} — {appliedFilter.station_name || 'Các trạm đã lọc'}</div><Badge color="blue">{appliedFilter.date_from} → {appliedFilter.date_to}</Badge></div>
              {hasSeries ? <TimeSeriesChart points={timeSeries} metric={appliedFilter.metric} /> : empty}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4"><div>
            <div className="flex items-center justify-between mb-2"><div className="text-xs font-semibold text-slate-600">Phân bố tháng — {getMetricLabel(appliedFilter.metric)}</div>
              <select aria-label="Năm phân bố tháng" value={chartYear ?? ''} onChange={event => setSelectedYear(Number(event.target.value))} className="text-xs rounded px-2.5 py-1 border border-slate-300 outline-none font-medium text-slate-700">{yearOptions.map(year => <option key={year} value={year}>{year}</option>)}</select>
            </div>
            {monthlyHasValues ? <MonthlyBarChart data={monthlyData} year={chartYear} metric={appliedFilter.metric} stations={scopedStations.map(station => station.station_name)} /> : empty}
          </div><div><div className="text-xs font-semibold mb-2 text-slate-600">Mức độ đầy đủ {getMetricLabel(appliedFilter.metric)} theo trạm và năm</div>
            {quality.length > 0 ? <CompletenessHeatmap stations={heatmapStations} years={heatmapYears} getValue={getQualityValue} label="Số ngày có giá trị hợp lệ / số ngày kỳ vọng trong phạm vi lọc (%)" /> : empty}
          </div></div>
          <div><div className="text-xs font-semibold mb-2 text-slate-600">Bảng dữ liệu khí tượng theo {RESOLUTION_LABELS[appliedFilter.resolution]} (từ CSV gốc)</div><DataTable data={tableRows} resolution={appliedFilter.resolution} metric={appliedFilter.metric} /></div>
        </div>}
        {tab === 'compare' && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><div className="rounded-lg p-3 bg-blue-50 border border-blue-200"><div className="text-xs font-semibold mb-1 text-blue-700">Trạm A (Thang đo chuẩn)</div><Select value={compareA} onChange={setCompareA} options={stationOptions} /></div>
            <div className="rounded-lg p-3 bg-teal-50 border border-teal-200"><div className="text-xs font-semibold mb-1 text-cyan-700">Trạm B (Thang đo đối sánh)</div><Select value={compareB} onChange={setCompareB} options={stationOptions} /></div></div>
          <Card className="p-4"><SectionHeader title={`So sánh diễn biến: ${compareA || '—'} và ${compareB || '—'}`} description={`${getMetricLabel(appliedFilter.metric)} · theo ${RESOLUTION_LABELS[appliedFilter.resolution]} · ${appliedFilter.date_from} → ${appliedFilter.date_to}`} badge={<Badge color="green">ĐỒNG NHẤT THANG ĐO</Badge>} />
            {comparisonLoading ? <p role="status" className="text-xs text-slate-500 py-12 text-center">Đang tải dữ liệu đối sánh…</p> : comparisonError ? <EmptyState title="Không thể tải đối sánh" description={comparisonError} /> : hasComparison ? <ComparisonLineChart dataA={compareDataA} dataB={compareDataB} labelA={compareA} labelB={compareB} metric={appliedFilter.metric} height={280} /> : empty}
          </Card>
          <Card className="p-4"><SectionHeader title="Bảng thống kê sai biệt thống kê học (Descriptive Statistics)" description="Thống kê riêng trên các giá trị hợp lệ của mỗi trạm; các kỳ thiếu dữ liệu được giữ nguyên." />
            {!comparisonLoading && !comparisonError && <ComparisonStatsTable labelA={compareA} labelB={compareB} valuesA={compareDataA.map(point => point.value)} valuesB={compareDataB.map(point => point.value)} metric={appliedFilter.metric} resolution={appliedFilter.resolution} />}
          </Card>
        </div>}
        {tab === 'advanced' && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4"><SectionHeader title={`Xu hướng năm: ${getMetricLabel(appliedFilter.metric)}`} description="Tổng hợp trong phạm vi lọc; kỳ chưa đầy đủ có cảnh báo phía trên." badge={<Badge color="blue">DỮ LIỆU QUAN TRẮC</Badge>} />
              {hasSeries ? <YearlyLineChart data={yearlyData} metric={appliedFilter.metric} stations={scopedStations.map(station => station.station_name)} /> : empty}
            </Card>
            <Card className="p-4"><SectionHeader title={`Phân bố tháng — ${chartYear ?? 'Không có năm phù hợp'}`} description={`${getMetricLabel(appliedFilter.metric)} trong khoảng ngày đã chọn`} actions={<select aria-label="Năm phân tích chuyên sâu" value={chartYear ?? ''} onChange={event => setSelectedYear(Number(event.target.value))} className="text-xs rounded border border-slate-300 p-1">{yearOptions.map(year => <option key={year} value={year}>{year}</option>)}</select>} />
              {monthlyHasValues ? <MonthlyBarChart data={monthlyData} year={chartYear} metric={appliedFilter.metric} stations={scopedStations.map(station => station.station_name)} /> : empty}
            </Card>
          </div>
          <Card className="p-4"><SectionHeader title="Bản ghi mưa bất thường cần kiểm chứng" description="Lọc cùng phạm vi tỉnh, trạm và thời gian; giữ giá trị nguồn, không gắn nhãn đã xác thực." badge={<Badge color="red">{extremes.length} BẢN GHI</Badge>} />
            {extremes.length === 0 ? <EmptyState title="Không có bản ghi bất thường phù hợp" description={appliedFilter.metric === 'rainfall_mm' ? 'Không có cờ mưa bất thường trong phạm vi đã chọn.' : 'Danh sách này dành cho chỉ số lượng mưa. Chọn lượng mưa để xem cờ kiểm chứng.'} /> : <div className="grid grid-cols-4 gap-3">{extremes.map((record, index) => <div key={`${record.station_name}-${record.datetime}-${index}`} className="rounded-lg p-3 border border-red-200 bg-red-50">
              <div className="flex items-center justify-between text-xs text-slate-500"><span className="font-semibold text-slate-800">{record.station_name}</span><span className="font-mono text-red-600">{record.datetime.slice(0, 10)}</span></div>
              <div className="text-xl font-bold mt-1 text-red-600">{record.precip_reported_mm} mm</div><div className="text-[11px] text-slate-500 mt-1">Cờ: <span className="font-mono">{record.precip_flag}</span></div>
              <div className="text-[11px] text-amber-800 mt-1 break-words">Cần kiểm chứng · {record.status}</div>{record.source_url && <a href={record.source_url} className="text-xs text-blue-600 underline" target="_blank" rel="noreferrer">Nguồn quan trắc</a>}
            </div>)}</div>}
          </Card>
          <Card className="p-4"><SectionHeader title="Giải thích phương pháp tính toán & Ghi chú phân tích" /><div className="text-xs space-y-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p>• <strong>Tổng lượng mưa:</strong> Cộng các giá trị ngày hợp lệ trong phạm vi lọc. Không có giá trị hợp lệ thì kết quả là thiếu dữ liệu; 0 mm chỉ dành cho quan trắc bằng 0.</p>
            <p>• <strong>Nhiệt độ và độ ẩm:</strong> Trung bình các giá trị hợp lệ từ dữ liệu ngày; giá trị thiếu không tham gia mẫu số.</p>
            <p>• <strong>Độ đầy đủ:</strong> Tính riêng từng chỉ số trên số ngày kỳ vọng. Tổng mưa của kỳ thiếu quan trắc chỉ là tổng phần đã quan sát.</p>
            <p>• <strong>Chất lượng và thời gian:</strong> Cờ nguồn và bản ghi cần kiểm chứng được bảo toàn. Không lấp khoảng trống hoặc suy diễn mực nước từ dữ liệu khí tượng.</p>
          </div></Card>
        </div>}
      </>}</div>
    </Card>
  </div>;
}
