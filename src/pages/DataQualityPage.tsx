import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Database, Upload, AlertTriangle, CheckCircle2, FileText, Eye, X, Info } from 'lucide-react';
import { Card, Button, Badge, Tabs, Select, EmptyState, LoadingSpinner } from '../components/ui';
import { CompletenessHeatmap } from '../components/charts';
import { dataService } from '../services/dataService';
import type { DatasetStats, MetricKey } from '../types';

// Schema descriptions are static; counts, dates and observations come from the data service.
const DATASETS = [
  { id: 'dataset_ngay', name: 'Dataset_ngay.csv', description: 'Khí tượng theo ngày UTC (SSODv2 / GSOD)', fields: ['datetime', 'longitude', 'latitude', 'province_code', 'station_name', 'rainfall_mm', 'river_level_m', 'temperature_c', 'humidity_pct'], source: 'NOAA SSODv2 / GSOD', note: 'Ngày UTC là nhãn ngày, không phải giờ đo. Ô thiếu giữ null.' },
  { id: 'tram_do', name: 'Tram_do.csv', description: 'Metadata trạm khí tượng và nguồn thu thập', fields: ['station_name', 'source_station_id', 'legacy_isd_id', 'province_code', 'province_name', 'longitude', 'latitude', 'first_date', 'last_date', 'n_rows', 'n_rainfall', 'n_temperature', 'n_humidity', 'climate_source', 'latest_source_url', 'isd_distance_km'], source: 'Metadata NOAA', note: 'Tọa độ WGS84 theo nguồn; không dùng tọa độ trạm mưa thay cho thủy chí cùng tên.' },
  { id: 'tinh_thanh', name: 'Tinh_thanh.csv', description: 'Danh mục tỉnh/thành trong phạm vi nghiên cứu', fields: ['province_code', 'province_name', 'n_weather_stations', 'n_daily_rows', 'n_river_records', 'coverage_note'], source: 'Danh mục phạm vi nghiên cứu', note: 'Mã nội bộ theo địa giới trước sáp nhập để nhất quán lịch sử.' },
  { id: 'muc_nuoc', name: 'Muc_nuoc_ban_tin.csv', description: 'Số đo rời rạc từ bản tin thủy văn', fields: ['datetime', 'longitude', 'latitude', 'province_code', 'station_name', 'rainfall_mm', 'river_level_m', 'temperature_c', 'humidity_pct', 'timezone', 'observation_type', 'river_name', 'source_url', 'water_level_datum', 'quality_note'], source: 'URL gốc trong từng bản tin', note: 'Giờ quan trắc tại Việt Nam (UTC+7); không phải chuỗi ngày liên tục. Xem loại quan trắc và mốc cao độ từng dòng.' },
  { id: 'chat_luong', name: 'Chat_luong.csv', description: 'Cờ chất lượng và giá trị nguồn', fields: ['datetime', 'station_name', 'source_station_id', 'precip_flag', 'precip_reported_mm', 'precip_status', 'temperature_n_obs', 'humidity_n_hours', 'humidity_method', 'humidity_status', 'isd_distance_km'], source: 'Thông tin chất lượng từ nguồn quan trắc', note: 'Ghép với chuỗi ngày bằng tên trạm + ngày UTC; mưa ≥500 mm cần kiểm chứng, không tự động loại bỏ.' },
  { id: 'mo_ta', name: 'Mo_ta.csv', description: 'Từ điển dữ liệu, đơn vị và giới hạn', fields: ['field_or_topic', 'data_type', 'unit', 'definition_or_value', 'notes'], source: 'Tài liệu phương pháp của bộ dữ liệu', note: 'Định nghĩa cột, kỳ quan trắc, múi giờ, giới hạn và quy tắc ghép nguồn.' },
];

type ClimateMetric = Exclude<MetricKey, 'river_level_m'>;
const METRICS: { value: ClimateMetric; label: string; field: keyof Pick<DatasetStats, 'completeness_rainfall_pct' | 'completeness_temperature_pct' | 'completeness_humidity_pct'> }[] = [
  { value: 'rainfall_mm', label: 'Lượng mưa', field: 'completeness_rainfall_pct' },
  { value: 'temperature_c', label: 'Nhiệt độ', field: 'completeness_temperature_pct' },
  { value: 'humidity_pct', label: 'Độ ẩm', field: 'completeness_humidity_pct' },
];
const formatCount = (value: number) => value.toLocaleString('vi-VN');
const formatPercent = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;

async function loadCatalog() {
  const [stations, provinces, descriptions, manifest, summary, river] = await Promise.all([
    dataService.getStations(), dataService.getProvinces(), dataService.getDescriptions(),
    dataService.getManifest(), dataService.getSummaryStats(), dataService.getRiverRecords(),
  ]);
  return { stations, provinces, descriptions, manifest, summary, river };
}

async function loadQuality(filter: Parameters<typeof dataService.getQualityStats>[0]) {
  const [stats, summary, anomalies] = await Promise.all([
    dataService.getQualityStats(filter), dataService.getSummaryStats(filter), dataService.getAnomalies(filter),
  ]);
  return { stats, summary, anomalies };
}

function CSVUploadPanel() {
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][]; count: number; errors: string[]; schema: string | null } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const readId = useRef(0);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const id = ++readId.current;
    setFileName(file.name);
    setPreview(null);
    setError('');
    const reader = new FileReader();
    reader.onerror = () => { if (id === readId.current) setError('Không đọc được tệp CSV.'); };
    reader.onload = result => {
      if (id !== readId.current) return;
      const parsed = Papa.parse<string[]>(String(result.target?.result ?? ''), { skipEmptyLines: 'greedy' });
      const [rawHeaders = [], ...rows] = parsed.data;
      const headers = rawHeaders.map(header => header.replace(/^\uFEFF/, '').trim());
      const schema = DATASETS.find(dataset => dataset.name.toLowerCase() === file.name.toLowerCase())
        ?? DATASETS.find(dataset => dataset.fields.every(field => headers.includes(field)));
      const errors = parsed.errors.map(issue => `Dòng ${(issue.row ?? 0) + 1}: ${issue.message}`);
      if (!headers.length || headers.every(header => !header)) errors.push('Tệp không có hàng tiêu đề.');
      if (headers.some(header => !header)) errors.push('Có tên cột trống.');
      if (new Set(headers).size !== headers.length) errors.push('Có tên cột trùng nhau.');
      if (!rows.length) errors.push('Tệp không có bản ghi dữ liệu.');
      if (!schema) errors.push('Chưa nhận diện được cấu trúc của một trong các CSV nguồn.');
      if (schema) {
        const missing = schema.fields.filter(field => !headers.includes(field));
        if (missing.length) errors.push(`Thiếu cột: ${missing.join(', ')}.`);
      }
      const malformed = rows.filter(row => row.length !== headers.length).length;
      if (malformed) errors.push(`${formatCount(malformed)} dòng có số ô khác số cột trong tiêu đề.`);
      setPreview({ headers, rows: rows.slice(0, 10), count: rows.length, errors, schema: schema?.name ?? null });
    };
    reader.readAsText(file, 'utf-8');
  };

  return <div className="space-y-4">
    <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-blue-400" style={{ borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }} onClick={() => fileRef.current?.click()}>
      <Upload size={28} className="mx-auto mb-3 text-slate-400" />
      <div className="text-sm font-medium text-slate-600">{fileName ? `Đã đọc tệp: ${fileName}` : 'Nhấn để chọn file CSV cần kiểm tra cấu trúc'}</div>
      <div className="text-xs mt-1 text-slate-400">Đọc dấu phẩy, dấu ngoặc kép và xuống dòng trong ô. Chỉ xem trước trên trình duyệt; chưa lưu vào bộ dữ liệu.</div>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
    </div>
    {error && <div role="alert" className="text-xs text-red-600">{error}</div>}
    {preview && <div className="bg-white p-4 rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 mb-2"><Eye size={14} className="text-cyan-600" /><span className="text-sm font-semibold text-slate-800">Xem trước {preview.rows.length} / {formatCount(preview.count)} dòng</span><button aria-label="Đóng xem trước" onClick={() => { ++readId.current; setPreview(null); setFileName(null); if (fileRef.current) fileRef.current.value = ''; }} className="ml-auto text-slate-400 hover:text-slate-600"><X size={14} /></button></div>
      <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{preview.headers.map((header, index) => <th key={index} className="text-left px-2.5 py-2 font-semibold border-b border-slate-200 text-slate-600 whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index} className="border-t border-slate-100">{row.map((cell, column) => <td key={column} className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap">{cell}</td>)}</tr>)}</tbody></table></div>
      {preview.errors.length ? <div role="alert" className="mt-2 text-xs text-red-700 space-y-1">{preview.errors.map((issue, index) => <p key={index}>{issue}</p>)}</div> : <div className="mt-2 text-xs text-blue-700">Cấu trúc cột phù hợp {preview.schema}. Chưa kiểm tra chất lượng từng giá trị và chưa nhập vào dữ liệu đang phân tích.</div>}
    </div>}
  </div>;
}

export default function DataQualityPage() {
  const [tab, setTab] = useState('datasets');
  const [expandedDataset, setExpandedDataset] = useState<string | null>('dataset_ngay');
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadCatalog>> | null>(null);
  const [quality, setQuality] = useState<Awaited<ReturnType<typeof loadQuality>> | null>(null);
  const [error, setError] = useState('');
  const [qualityError, setQualityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [stationName, setStationName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [metric, setMetric] = useState<ClimateMetric | ''>('');
  const [anomalyPage, setAnomalyPage] = useState(0);

  useEffect(() => {
    let active = true;
    loadCatalog().then(result => {
      if (!active) return;
      setCatalog(result);
      setDateFrom(result.summary.date_from.slice(0, 10));
      setDateTo(result.summary.date_to.slice(0, 10));
    }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    let active = true;
    setLoading(true);
    setQualityError('');
    setAnomalyPage(0);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setQuality(null);
      setQualityError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
      setLoading(false);
      return;
    }
    loadQuality({ station_name: stationName || null, date_from: dateFrom, date_to: dateTo, ...(metric ? { metric } : {}) })
      .then(result => { if (active) setQuality(result); })
      .catch(reason => { if (active) { setQualityError(String(reason)); setQuality(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [catalog, stationName, dateFrom, dateTo, metric]);

  const years = useMemo(() => [...new Set(quality?.stats.map(row => row.year) ?? [])].sort((a, b) => a - b), [quality]);
  const stationNames = useMemo(() => [...new Set(quality?.stats.map(row => row.station_name) ?? [])], [quality]);
  const qualityIndex = useMemo(() => new Map(quality?.stats.map(row => [`${row.station_name}:${row.year}`, row]) ?? []), [quality]);
  const visibleMetrics = METRICS.filter(item => !metric || item.value === metric);
  const anomalyCount = quality?.anomalies.length ?? 0;
  const anomalyPages = Math.max(1, Math.ceil(anomalyCount / 20));
  const page = Math.min(anomalyPage, anomalyPages - 1);
  const anomalyRows = quality?.anomalies.slice(page * 20, (page + 1) * 20) ?? [];
  const hasQualityRecords = Boolean(quality && quality.summary.total_records > 0);

  if (error) return <Card><EmptyState title="Không tải được nguồn dữ liệu" description={error} /></Card>;
  if (!catalog) return <LoadingSpinner />;
  const { stations, provinces, descriptions, manifest, summary, river } = catalog;
  const sourceRows: Record<string, number> = manifest.source_rows;
  const riverDates = river.map(row => row.datetime).sort();
  const sourceCount = Object.keys(sourceRows).length;
  const coverage = quality?.summary.completeness;
  const qualityCards = coverage ? [
    { label: 'Ngày-trạm kỳ vọng', count: coverage.expected_days, percent: null },
    { label: 'Ngày-trạm có bản ghi', count: coverage.recorded_days, percent: coverage.record_completeness_pct },
    { label: 'Ngày mưa hợp lệ (gồm 0 mm)', count: coverage.valid_rainfall_days, percent: coverage.rainfall_completeness_pct },
    { label: 'Ngày nhiệt độ hợp lệ', count: coverage.valid_temperature_days, percent: coverage.temperature_completeness_pct },
    { label: 'Ngày độ ẩm hợp lệ', count: coverage.valid_humidity_days, percent: coverage.humidity_completeness_pct },
  ] : [];

  return <div className="space-y-4 max-w-[1400px]">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold" style={{ color: '#12304A' }}>Nguồn & chất lượng dữ liệu</h1><p className="text-sm mt-0.5 text-slate-500">Theo dõi nguồn CSV, độ đầy đủ chuỗi thời gian và cờ chất lượng</p></div><div className="flex items-center gap-2"><Badge color="blue">Đã đọc {sourceCount} CSV nguồn</Badge><span className="text-xs text-slate-500">{formatCount(summary.total_records)} bản ghi khí tượng</span></div></div>
    {manifest.warnings.length > 0 && <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900">{manifest.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 border-b border-slate-200"><Tabs tabs={[
        { id: 'datasets', label: '1. Danh mục bộ dữ liệu CSV', icon: <Database size={14} /> },
        { id: 'quality', label: '2. Chất lượng & độ đầy đủ', icon: <CheckCircle2 size={14} /> },
        { id: 'anomalies', label: '3. Bất thường & cần kiểm chứng', icon: <AlertTriangle size={14} /> },
        { id: 'dictionary', label: '4. Từ điển dữ liệu', icon: <FileText size={14} /> },
        { id: 'upload', label: '5. Nhập thêm dữ liệu CSV', icon: <Upload size={14} /> },
      ]} activeTab={tab} onChange={setTab} /></div>
      <div className="p-4">
        {(tab === 'quality' || tab === 'anomalies') && <div className="grid grid-cols-4 gap-3 mb-4">
          <Select label="Trạm khí tượng" value={stationName} onChange={setStationName} options={[{ value: '', label: 'Tất cả trạm' }, ...stations.map(station => ({ value: station.station_name, label: station.station_name }))]} />
          <label className="text-xs text-slate-500">Từ ngày<input aria-label="Từ ngày chất lượng" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="block w-full border border-slate-200 rounded-lg p-2 mt-1 text-sm text-slate-700" /></label>
          <label className="text-xs text-slate-500">Đến ngày<input aria-label="Đến ngày chất lượng" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="block w-full border border-slate-200 rounded-lg p-2 mt-1 text-sm text-slate-700" /></label>
          <Select label="Chỉ số" value={metric} onChange={value => setMetric(value as ClimateMetric | '')} options={[{ value: '', label: 'Tất cả chỉ số khí tượng' }, ...METRICS]} />
        </div>}

        {tab === 'datasets' && <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3 mb-2">
            {[{ value: `${sourceCount} File`, label: 'File CSV nguồn', classes: 'bg-blue-50 border-blue-200 text-blue-700' }, { value: formatCount(summary.total_records), label: 'Bản ghi khí tượng ngày', classes: 'bg-emerald-50 border-emerald-200 text-emerald-700' }, { value: formatCount(river.length), label: 'Bản tin mực nước rời rạc', classes: 'bg-cyan-50 border-cyan-200 text-cyan-700' }, { value: `${stations.length} Trạm`, label: 'Trạm khí tượng trong metadata', classes: 'bg-amber-50 border-amber-200 text-amber-700' }].map(item => <div key={item.label} className={`rounded-lg p-3 text-center border ${item.classes}`}><div className="text-2xl font-bold">{item.value}</div><div className="text-xs mt-0.5">{item.label}</div></div>)}
          </div>
          {DATASETS.map(dataset => {
            const available = Object.prototype.hasOwnProperty.call(sourceRows, dataset.name);
            const timeRange = ['dataset_ngay', 'chat_luong', 'tram_do'].includes(dataset.id) ? `${summary.date_from.slice(0, 10)} → ${summary.date_to.slice(0, 10)}` : dataset.id === 'muc_nuoc' && riverDates.length ? `${riverDates[0].slice(0, 10)} → ${riverDates[riverDates.length - 1].slice(0, 10)}` : null;
            return <div key={dataset.id} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedDataset(expandedDataset === dataset.id ? null : dataset.id)}>
                <FileText size={18} className="text-blue-600" /><div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold font-mono text-slate-800">{dataset.name}</span><Badge color={available ? 'green' : 'red'}>{available ? 'Đã đọc' : 'Thiếu tệp'}</Badge><span className="text-xs text-slate-400">· {dataset.description}</span></div></div><span className="text-xs text-slate-500 font-mono">{available ? `${formatCount(sourceRows[dataset.name])} dòng nguồn` : '—'}</span>
              </div>
              {expandedDataset === dataset.id && <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50"><div className="grid grid-cols-2 gap-4 mt-3"><div><div className="text-xs font-semibold mb-1 text-slate-700">Thông tin xuất xứ</div><div className="space-y-1 text-xs text-slate-600"><div><strong>Nguồn dữ liệu:</strong> {dataset.source}</div>{timeRange && <div><strong>Phạm vi thời gian:</strong> {timeRange}</div>}<div><strong>Ghi chú:</strong> {dataset.note}</div></div></div><div><div className="text-xs font-semibold mb-1 text-slate-700">Các trường theo cấu trúc nguồn</div><div className="flex flex-wrap gap-1">{dataset.fields.map(field => <span key={field} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-white border border-slate-200 text-cyan-800">{field}</span>)}</div></div></div></div>}
            </div>;
          })}
          <div className="mt-4"><div className="text-sm font-semibold mb-2 text-slate-800">Metadata {stations.length} trạm khí tượng (Tram_do.csv)</div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs">
            <thead className="bg-slate-50"><tr>{['Tên trạm', 'Mã nguồn NOAA', 'Tỉnh / Thành', 'Kinh độ', 'Vĩ độ', 'Bản ghi ngày', 'Ngày mưa hợp lệ', 'Nguồn', 'Khoảng cách ISD'].map(header => <th key={header} className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">{header}</th>)}</tr></thead>
            <tbody>{stations.map(station => <tr key={station.station_name} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-3 py-2 font-medium text-slate-900">{station.station_name}</td><td className="px-3 py-2 font-mono text-slate-500">{station.source_station_id}</td><td className="px-3 py-2 text-slate-600">{station.province_name}</td><td className="px-3 py-2 font-mono text-slate-600">{station.longitude}°E</td><td className="px-3 py-2 font-mono text-slate-600">{station.latitude}°N</td><td className="px-3 py-2 font-mono text-slate-700">{formatCount(station.n_rows)}</td><td className="px-3 py-2 font-mono text-slate-700">{formatCount(station.n_rainfall)}</td><td className="px-3 py-2 font-mono text-slate-500">{station.climate_source}</td><td className="px-3 py-2 font-mono text-slate-500">{station.isd_distance_km === null ? '—' : `${station.isd_distance_km} km`}</td></tr>)}</tbody>
          </table></div><p className="text-xs text-slate-400 mt-2">Ngày có lượng mưa hợp lệ bao gồm 0 mm. Số ngày hợp lệ bằng 0 không chứng minh nguyên nhân thiếu cảm biến.</p></div>
        </div>}

        {(tab === 'quality' || tab === 'anomalies') && (loading ? <LoadingSpinner /> : qualityError ? <EmptyState title="Không tải được dữ liệu chất lượng" description={qualityError} /> : !hasQualityRecords ? <EmptyState title="Không có dữ liệu phù hợp" description="Chọn trạm hoặc giai đoạn khác." /> : null)}

        {tab === 'quality' && !loading && !qualityError && quality && hasQualityRecords && <div className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-800"><strong>Cách tính độ đầy đủ:</strong> số ngày có giá trị hợp lệ của từng chỉ số chia cho số ngày-trạm kỳ vọng trong khoảng lọc. Số ngày có bản ghi được tính riêng. Đây là độ phủ quan trắc, không phải chứng nhận chất lượng hoặc bằng chứng thiết bị hoạt động liên tục.</div>
          <div className="grid grid-cols-5 gap-2">{qualityCards.map(item => <div key={item.label} className="rounded-lg p-3 bg-slate-50 border border-slate-200"><div className="text-lg font-bold text-blue-700">{formatCount(item.count)}</div><div className="text-xs text-slate-600">{item.label}</div>{item.percent !== null && <div className="text-xs mt-1 text-cyan-700">{formatPercent(item.percent)}</div>}</div>)}</div>
          {visibleMetrics.map(item => <div key={item.value}><CompletenessHeatmap stations={stationNames} years={years} getValue={(station, year) => qualityIndex.get(`${station}:${year}`)?.[item.field] ?? null} label={`${item.label}: ngày có giá trị hợp lệ / ngày kỳ vọng (%)`} /></div>)}
          <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{['Trạm / Năm', 'Ngày kỳ vọng', 'Có bản ghi', 'Mưa hợp lệ', 'Nhiệt độ hợp lệ', 'Độ ẩm hợp lệ'].map(header => <th key={header} className="text-left px-3 py-2 font-semibold text-slate-600">{header}</th>)}</tr></thead><tbody>{quality.stats.map(row => <tr key={`${row.station_name}:${row.year}`} className="border-t border-slate-100"><td className="px-3 py-2">{row.station_name} · {row.year}</td><td className="px-3 py-2">{row.expected_days}</td><td className="px-3 py-2">{row.recorded_days}</td><td className="px-3 py-2">{row.valid_rainfall}</td><td className="px-3 py-2">{row.valid_temperature}</td><td className="px-3 py-2">{row.valid_humidity}</td></tr>)}</tbody></table></div>
          <p className="text-xs text-slate-500">Năm bị cắt bởi khoảng lọc hoặc chưa có đủ ngày quan trắc phải được đọc cùng số ngày kỳ vọng và số ngày hợp lệ; không suy ra tổng năm đầy đủ.</p>
          <div><div className="text-sm font-semibold mb-2 text-slate-800">Phạm vi nguồn của {provinces.length} tỉnh/thành (toàn bộ dữ liệu)</div><div className="grid grid-cols-2 gap-2">{provinces.map(province => <div key={province.province_code} className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 text-xs ${province.n_daily_rows > 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}><div className={`w-2 h-2 rounded-full flex-shrink-0 ${province.n_daily_rows > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} /><div className="flex-1 font-medium text-slate-800">{province.province_name}</div><div className="text-slate-500">{province.n_daily_rows > 0 ? `${formatCount(province.n_daily_rows)} bản ghi ngày` : province.coverage_note}</div></div>)}</div></div>
        </div>}

        {tab === 'anomalies' && !loading && !qualityError && quality && hasQualityRecords && <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg p-3 text-xs bg-amber-50 border border-amber-200 text-amber-900"><Info size={14} className="mt-0.5 flex-shrink-0" /><span><strong>Nguyên tắc khoa học:</strong> Không tự coi mưa lớn là lỗi hay sự kiện lũ. Giá trị nguồn và cờ chất lượng được giữ để đối chiếu. Null khác 0 mm; không tạo giá trị lấp khoảng trống.</span></div>
          <div className="flex items-center justify-between text-xs text-slate-500"><span>{formatCount(anomalyCount)} bản ghi có vấn đề hoặc cần kiểm chứng trong bộ lọc</span><span>Trang {page + 1}/{anomalyPages}</span></div>
          {!anomalyRows.length ? <EmptyState title="Không có bản ghi bất thường phù hợp" description="Điều này không đồng nghĩa dữ liệu đã được chứng nhận." /> : <div className="space-y-2.5">{anomalyRows.map(row => <div key={`${row.station_name}:${row.datetime}`} className="p-3 rounded-lg border bg-white border-slate-200 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" /><div className="space-y-1 flex-1"><div className="flex justify-between items-center"><span className="text-xs font-semibold text-slate-800">{row.station_name} · {row.datetime.slice(0, 10)} (ngày UTC)</span><span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{row.quality_status}</span></div>
            <div className="text-xs text-slate-600">{row.quality_issues?.join(' · ') || 'Xem trạng thái chất lượng nguồn.'}</div>
            <div className="text-xs text-slate-500">Mưa nguồn: {row.quality?.precip_reported_mm === null || row.quality?.precip_reported_mm === undefined ? 'Không có dữ liệu' : `${row.quality.precip_reported_mm} mm`} · Cờ: {row.quality?.precip_flag || '—'} · {row.quality?.precip_status || 'Chưa có bản ghi chất lượng'}</div>
            {row.source_url && <a href={row.source_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">Đối chiếu dữ liệu nguồn</a>}
          </div></div>)}</div>}
          <div className="flex justify-end gap-2"><Button size="sm" disabled={page === 0} onClick={() => setAnomalyPage(page - 1)}>Trước</Button><Button size="sm" disabled={page >= anomalyPages - 1} onClick={() => setAnomalyPage(page + 1)}>Sau</Button></div>
          <div className="rounded-lg p-4 bg-slate-50 border border-slate-200"><div className="text-xs font-semibold mb-2 text-slate-800">Ý nghĩa cờ theo Mo_ta.csv</div><div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div><strong>D / F / G / 24:</strong> D = 4×6h; F = 2×12h; G = 1×24h; 24 = 24 báo cáo giờ. Kỳ đủ 24 giờ theo nguồn.</div>
            <div><strong>A / B / C / E / H / I:</strong> A/B/C/E thiếu kỳ; H/I không chứng minh được 0 mm. Giá trị gốc vẫn giữ ở bảng chất lượng.</div>
            <div><strong>EXTREME_GE_500MM_REQUIRES_CHECK:</strong> giữ giá trị mưa nguồn và đánh dấu cần kiểm chứng; chưa xác thực.</div>
            <div><strong>Độ ẩm:</strong> trung bình RH hợp lệ của ít nhất 4 giờ; xem phương pháp và trạng thái nguồn. Nhiệt độ trung bình ngày không bảo đảm có đủ 24 số đo.</div>
          </div></div>
        </div>}

        {tab === 'dictionary' && <div className="space-y-3"><div className="text-xs text-slate-500">Nội dung nguyên bản từ Mo_ta.csv ({descriptions.length} mục)</div>{!descriptions.length ? <EmptyState title="Chưa có từ điển dữ liệu" /> : <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{['Trường / Chủ đề', 'Kiểu dữ liệu', 'Đơn vị', 'Định nghĩa & Giá trị', 'Ghi chú phương pháp'].map(header => <th key={header} className="text-left px-3 py-2 font-semibold text-slate-600">{header}</th>)}</tr></thead><tbody>{descriptions.map((description, index) => <tr key={index} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-3 py-2 font-mono font-medium text-blue-700">{description.field_or_topic}</td><td className="px-3 py-2 font-mono text-slate-500">{description.data_type}</td><td className="px-3 py-2 text-slate-600">{description.unit || '—'}</td><td className="px-3 py-2 text-slate-700">{description.definition_or_value}</td><td className="px-3 py-2 text-slate-500 italic">{description.notes}</td></tr>)}</tbody></table></div>}</div>}

        {tab === 'upload' && <div className="space-y-4"><div className="text-sm font-semibold text-slate-800">Nhập dữ liệu CSV mới để kiểm tra cấu trúc</div><CSVUploadPanel /><div className="rounded-lg p-4 bg-slate-50 border border-slate-200"><div className="text-sm font-semibold mb-2 text-slate-800">Phạm vi chức năng nhập dữ liệu</div><p className="text-xs text-slate-600">Tệp được đọc cục bộ để xem trước và kiểm tra cấu trúc. Để cập nhật bộ dữ liệu nghiên cứu, cần chạy quy trình xử lý CSV của dự án rồi kiểm tra lại kết quả. Kết nối nguồn tự động và lưu dữ liệu qua backend chưa được triển khai.</p></div></div>}
      </div>
    </Card>
  </div>;
}
