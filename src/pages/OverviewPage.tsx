import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Database, TrendingUp, Map as MapIcon, BarChart2, ArrowRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, StatCard, SectionHeader, Badge, Select, EmptyState, LoadingSpinner } from '../components/ui';
import { YearlyLineChart } from '../components/charts';
import StationMap from '../components/maps/StationMap';
import { dataService } from '../services/dataService';
import type { MetricKey, YearlyAggregate } from '../types';

async function loadOverview() {
  const [stations, provinces, quality, extremes, summary, manifest] = await Promise.all([
    dataService.getStations(), dataService.getProvinces(), dataService.getQualityStats(),
    dataService.getExtremeRecords(), dataService.getSummaryStats(), dataService.getManifest(),
  ]);
  return { stations, provinces, quality, extremes, summary, manifest };
}

const formatCount = (value: number) => value.toLocaleString('vi-VN');
const formatPercent = (value: number | null) => value === null ? 'Không có dữ liệu' : `${value.toFixed(1)}%`;

export default function OverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadOverview>> | null>(null);
  const [error, setError] = useState('');
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>('rainfall_mm');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [yearly, setYearly] = useState<YearlyAggregate[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    let active = true;
    loadOverview().then(result => {
      if (!active) return;
      setData(result);
      setDateFrom(result.summary.date_from.slice(0, 10));
      setDateTo(result.summary.date_to.slice(0, 10));
    }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!data) return;
    let active = true;
    setChartLoading(true);
    setChartError('');
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setYearly([]);
      setChartError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
      setChartLoading(false);
      return;
    }
    dataService.getYearlyData({ station_name: selectedStation, date_from: dateFrom, date_to: dateTo, metric })
      .then(rows => { if (active) setYearly(rows); })
      .catch(reason => { if (active) { setChartError(String(reason)); setYearly([]); } })
      .finally(() => { if (active) setChartLoading(false); });
    return () => { active = false; };
  }, [data, selectedStation, dateFrom, dateTo, metric]);

  const provinceStats = useMemo(() => data?.provinces.map(province => {
    const stats = data.quality.filter(row => row.province_code === province.province_code);
    const expected = stats.reduce((total, row) => total + row.expected_days, 0);
    const recorded = stats.reduce((total, row) => total + row.recorded_days, 0);
    return { ...province, expected, recorded, completeness: expected ? recorded / expected * 100 : null };
  }) ?? [], [data]);
  const chartStations = useMemo(() => selectedStation ? [selectedStation] : [...new Set(yearly.map(row => row.station_name))].slice(0, 4), [yearly, selectedStation]);
  const visibleYearly = useMemo(() => yearly.filter(row => chartStations.includes(row.station_name)), [yearly, chartStations]);
  const partialYears = useMemo(() => [...new Set(visibleYearly.filter(row => row.is_partial_year).map(row => row.year))], [visibleYearly]);
  const incompleteMetricYears = useMemo(() => [...new Set(visibleYearly.filter(row => row.completeness_pct < 100).map(row => row.year))], [visibleYearly]);
  const reviewYears = useMemo(() => [...new Set(visibleYearly.filter(row => row.quality_statuses?.includes('requires_review')).map(row => row.year))], [visibleYearly]);
  const hasChartValues = visibleYearly.some(row => metric === 'rainfall_mm' ? row.total_rainfall_mm !== null : metric === 'temperature_c' ? row.avg_temperature_c !== null : row.avg_humidity_pct !== null);

  if (error) return <Card><EmptyState title="Không tải được dữ liệu" description={error} /></Card>;
  if (!data) return <LoadingSpinner />;
  const { stations, summary, extremes, manifest } = data;
  const selected = stations.find(station => station.station_name === selectedStation);
  const range = `${summary.date_from.slice(0, 10)} → ${summary.date_to.slice(0, 10)}`;
  const researchQuestions = [
    { title: 'Biến động lượng mưa theo năm', description: `Lượng mưa biến động ra sao trong giai đoạn ${range}?`, icon: <TrendingUp size={18} />, metric: 'rainfall_mm' as const, resolution: 'year' as const },
    { title: 'Khác biệt mùa mưa giữa các trạm', description: 'So sánh lượng mưa theo tháng và kiểm tra mức độ đầy đủ của từng chuỗi.', icon: <BarChart2 size={18} />, metric: 'rainfall_mm' as const, resolution: 'month' as const },
    { title: 'Các bản ghi mưa cực lớn cần kiểm chứng', description: `${extremes.length} bản ghi từ 500 mm/ngày được gắn cờ; cần đối chiếu nguồn trước khi kết luận.`, icon: <AlertTriangle size={18} />, metric: 'rainfall_mm' as const, resolution: 'day' as const },
    { title: 'Biến động nhiệt độ & độ ẩm', description: 'Nhiệt độ và độ ẩm thay đổi theo mùa như thế nào trên các ngày có quan trắc?', icon: <BarChart2 size={18} />, metric: 'temperature_c' as const, resolution: 'month' as const },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#12304A' }}>Khám phá dữ liệu mưa lũ miền Trung</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Nền tảng trực quan hóa, phân tích và nghiên cứu dữ liệu khí tượng – thủy văn lịch sử</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="blue">{Object.keys(manifest.source_rows).length} CSV nguồn</Badge>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>{range}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Bản ghi khí tượng" value={formatCount(summary.total_records)} sub={`Toàn bộ dữ liệu ngày · ${summary.stations_with_daily_data} trạm`} icon={<Database size={20} />} color="#2563EB" />
        <StatCard label="Trạm khí tượng" value={`${summary.total_stations} trạm`} sub={`${summary.provinces_covered}/${summary.provinces_total} tỉnh có chuỗi khí tượng`} icon={<MapIcon size={20} />} color="#0891B2" />
        <StatCard label="Khoảng thời gian" value={`${summary.date_from.slice(0, 4)}–${summary.date_to.slice(0, 4)}`} sub={range} icon={<FileText size={20} />} color="#059669" />
        <StatCard label="Độ phủ ngày có bản ghi" value={formatPercent(summary.completeness.record_completeness_pct)} sub={`${formatCount(summary.completeness.recorded_days)} / ${formatCount(summary.completeness.expected_days)} ngày-trạm kỳ vọng`} icon={<CheckCircle2 size={20} />} color="#D97706" />
      </div>

      <div className="rounded-xl px-4 py-3 flex items-center justify-between text-xs" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
        <span><strong>Dữ liệu từ CSV gốc:</strong> {formatCount(summary.total_records)} bản ghi khí tượng và {formatCount(summary.river_records)} bản tin mực nước. Có cờ chất lượng; các giá trị cần kiểm chứng được giữ trạng thái riêng.</span>
        <Badge color="yellow">Chưa đối soát/chứng nhận</Badge>
      </div>
      {manifest.warnings.length > 0 && <div className="rounded-lg px-4 py-3 text-xs bg-amber-50 text-amber-900">{manifest.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}

      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-2">
          <Card className="p-4 h-full flex flex-col justify-between">
            <div>
              <SectionHeader title="Bản đồ trạm khí tượng miền Trung" description="Tọa độ WGS84 từ metadata nguồn; chọn trạm để lọc biểu đồ" />
              {stations.length ? <StationMap stations={stations} selectedStation={selectedStation} onSelectStation={setSelectedStation} height="340px" /> : <EmptyState title="Không có trạm quan trắc" />}
            </div>
            {selected && <div className="mt-3 rounded-lg p-3 text-xs space-y-1" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <div className="flex items-center justify-between"><span className="font-semibold text-blue-900">{selected.station_name} — {selected.province_name}</span><span className="font-mono text-blue-700">{selected.source_station_id}</span></div>
              <div className="text-blue-700">{formatCount(selected.n_rows)} bản ghi · {formatCount(selected.n_rainfall)} ngày có giá trị mưa hợp lệ (gồm cả 0 mm)</div>
              <div className="text-blue-600">{selected.first_date.slice(0, 10)} → {selected.last_date.slice(0, 10)} · {selected.climate_source}</div>
            </div>}
          </Card>
        </div>

        <div className="col-span-3 flex flex-col gap-5">
          <Card className="p-4">
            <SectionHeader title="Dữ liệu khí tượng theo năm" description="Mưa: tổng giá trị hợp lệ. Nhiệt độ/độ ẩm: trung bình ngày hợp lệ. Năm thiếu ngày không tương đương năm đầy đủ." badge={<Badge color="blue">CSV nguồn</Badge>} />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Select label="Trạm" value={selectedStation ?? ''} onChange={value => setSelectedStation(value || null)} options={[{ value: '', label: 'So sánh tối đa 4 trạm' }, ...stations.map(station => ({ value: station.station_name, label: station.station_name }))]} />
              <Select label="Chỉ số" value={metric} onChange={value => setMetric(value as MetricKey)} options={[{ value: 'rainfall_mm', label: 'Lượng mưa' }, { value: 'temperature_c', label: 'Nhiệt độ' }, { value: 'humidity_pct', label: 'Độ ẩm' }]} />
              <label className="text-xs text-slate-500">Từ ngày<input aria-label="Từ ngày tổng quan" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="block w-full border border-slate-200 rounded-lg p-2 mt-1 text-slate-700" /></label>
              <label className="text-xs text-slate-500">Đến ngày<input aria-label="Đến ngày tổng quan" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="block w-full border border-slate-200 rounded-lg p-2 mt-1 text-slate-700" /></label>
            </div>
            {chartLoading ? <LoadingSpinner /> : chartError ? <EmptyState title="Không tải được biểu đồ" description={chartError} /> : !hasChartValues ? <EmptyState title="Không có dữ liệu phù hợp" description="Chọn trạm, thời gian hoặc chỉ số khác. Giá trị thiếu được giữ là null." /> : <YearlyLineChart data={yearly} metric={metric} stations={chartStations} />}
            {!chartLoading && !chartError && hasChartValues && (partialYears.length > 0 || incompleteMetricYears.length > 0 || reviewYears.length > 0) && <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              {partialYears.length > 0 && <p>Năm chưa đầy đủ ngày trong phạm vi quan trắc hoặc bộ lọc: {partialYears.join(', ')}.</p>}
              {incompleteMetricYears.length > 0 && <p>Ít nhất một trạm đang hiển thị còn thiếu giá trị của chỉ số được chọn trong các năm: {incompleteMetricYears.join(', ')}.</p>}
              {reviewYears.length > 0 && <p>Có số liệu nguồn cần kiểm chứng trong các năm: {reviewYears.join(', ')}.</p>}
            </div>}
          </Card>
          <Card className="p-4">
            <SectionHeader title="Độ phủ bản ghi theo tỉnh / thành" description="Toàn bộ thời gian nguồn: số ngày-trạm có bản ghi / số ngày-trạm kỳ vọng; không phải tỷ lệ mưa hợp lệ" />
            <div className="grid grid-cols-2 gap-2">
              {provinceStats.map(province => {
                const color = province.completeness === null ? '#94A3B8' : province.completeness >= 95 ? '#059669' : province.completeness >= 80 ? '#D97706' : '#DC2626';
                return <div key={province.province_code} className="flex items-center gap-2.5 p-2 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0"><div className="text-xs font-medium truncate text-slate-800">{province.province_name}</div><div className="text-xs text-slate-400">{formatCount(province.recorded)} / {formatCount(province.expected)} ngày-trạm</div></div>
                  <div className="text-xs font-semibold" style={{ color }}>{province.completeness === null ? 'Chưa có chuỗi' : formatPercent(province.completeness)}</div>
                </div>;
              })}
            </div>
          </Card>
        </div>
      </div>

      {extremes.length > 0 && <Card className="p-4" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
        <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-red-600" /><h3 className="text-sm font-semibold text-red-900">Bản ghi mưa cực lớn cần kiểm chứng (≥ 500 mm / 24h)</h3></div><Badge color="red">{extremes.length} bản ghi được gắn cờ</Badge></div>
        <div className="grid grid-cols-4 gap-3 mt-3">{extremes.slice(0, 4).map(record => <div key={`${record.station_name}-${record.datetime}`} className="bg-white p-2.5 rounded-lg border border-red-200">
          <div className="flex justify-between items-center text-xs text-slate-500"><span>{record.station_name}</span><span className="font-mono">{record.datetime.slice(0, 10)}</span></div>
          <div className="text-lg font-bold text-red-600 mt-0.5">{record.precip_reported_mm} mm</div>
          <div className="text-[10px] text-slate-500 break-words">Cờ: {record.precip_flag} · {record.status}</div>
          {record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline">Đối chiếu nguồn NOAA</a>}
        </div>)}</div>
      </Card>}

      <div>
        <SectionHeader title="Gợi ý câu hỏi nghiên cứu khoa học" description="Chuyển đến Không gian phân tích với cấu hình bộ lọc tương ứng" />
        <div className="grid grid-cols-4 gap-4">{researchQuestions.map((question, index) => {
          const color = ['#2563EB', '#0891B2', '#D97706', '#059669'][index];
          return <Card key={question.title} hoverable className="p-4 flex flex-col justify-between" onClick={() => navigate('/analysis', { state: { filter: { station_name: selectedStation, province_code: null, metric: question.metric, resolution: question.resolution, date_from: dateFrom, date_to: dateTo } } })}>
            <div><div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${color}15`, color }}>{question.icon}</div><h3 className="text-sm font-semibold mb-1 text-slate-800">{question.title}</h3><p className="text-xs leading-relaxed text-slate-500">{question.description}</p></div>
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold" style={{ color }}>Khám phá dữ liệu <ArrowRight size={12} /></div>
          </Card>;
        })}</div>
      </div>

      <Card className="p-4"><div className="flex items-start gap-3"><Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#0891B2' }} /><div>
        <div className="text-sm font-semibold mb-2 text-slate-800">Nguyên tắc khoa học và cấu trúc dữ liệu</div>
        <ul className="text-xs space-y-1.5 text-slate-500">
          <li>• <strong>Độ đầy đủ riêng từng chỉ số:</strong> mưa {formatPercent(summary.completeness.rainfall_completeness_pct)}, nhiệt độ {formatPercent(summary.completeness.temperature_completeness_pct)}, độ ẩm {formatPercent(summary.completeness.humidity_completeness_pct)} trên cùng số ngày-trạm kỳ vọng.</li>
          <li>• <strong>Dữ liệu thiếu:</strong> giữ null; không nội suy, không đổi thành 0. Tổng mưa năm thiếu ngày chỉ phản ánh phần đã quan trắc.</li>
          <li>• <strong>Ngày khí tượng:</strong> nhãn ngày UTC, không phải giờ đo. Độ ẩm là trung bình giá trị theo giờ hợp lệ, có thể được dẫn xuất từ nhiệt độ và điểm sương.</li>
          <li>• <strong>Mực nước:</strong> bản tin rời rạc theo giờ Việt Nam, không ghép trực tiếp với ngày UTC, không suy diễn chuỗi liên tục hay bản đồ ngập.</li>
        </ul>
      </div></div></Card>
    </div>
  );
}
