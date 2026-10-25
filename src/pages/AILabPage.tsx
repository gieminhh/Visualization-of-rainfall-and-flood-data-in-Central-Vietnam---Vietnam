import { useEffect, useState } from 'react';
import { FlaskConical, Play, History, BarChart2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, SectionHeader, Select, Button, Badge, Tabs } from '../components/ui';
import { ForecastChart } from '../components/charts';
import { dataService } from '../services/dataService';
import { MODEL_NAMES, prepareMonths, runForecast } from '../services/forecasting';
import type { ForecastResult, ResearchModel } from '../services/forecasting';
import { downloadText, saveResearchSession } from '../services/reports';
import type { DataManifest, ResearchSession, Station } from '../types';

const HISTORY_KEY = 'cfr_experiments_v1';
interface SavedRun {
  id: string; createdAt: string; station: string; selected: ResearchModel;
  sources: DataManifest['source_files']; results: ForecastResult[];
}
const number = (value: number | null) => value === null ? 'Không xác định' : value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function AILabPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [station, setStation] = useState('Phú Bài');
  const [model, setModel] = useState<ResearchModel>('Ridge');
  const [horizon, setHorizon] = useState(3);
  const [tab, setTab] = useState('results');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [run, setRun] = useState<SavedRun | null>(null);
  const [history, setHistory] = useState<SavedRun[]>([]);
  useEffect(() => {
    let active = true;
    dataService.getStations().then(rows => {
      if (active) { setStations(rows); setStation(rows.some(row => row.station_name === 'Phú Bài') ? 'Phú Bài' : rows[0]?.station_name ?? ''); }
    }).catch(reason => { if (active) setError(String(reason)); });
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
      if (!Array.isArray(stored) || stored.some(row => !Array.isArray(row.results) || !row.id)) throw new Error('Lịch sử không đúng cấu trúc.');
      setHistory(stored);
    } catch { setNotice('Không đọc được lịch sử thí nghiệm đã lưu trên trình duyệt.'); }
    return () => { active = false; };
  }, []);
  const result = run?.results.find(item => item.model === run.selected);

  async function handleRun() {
    setBusy(true); setError(''); setNotice(''); setRun(null);
    try {
      const [rows, manifest] = await Promise.all([dataService.getMonthlyData({ station_name: station }), dataService.getManifest()]);
      const samples = prepareMonths(rows);
      const results = (['Ridge', 'Seasonal'] as ResearchModel[]).map(name => runForecast(samples, name, horizon));
      const completed: SavedRun = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), station, selected: model, sources: manifest.source_files, results };
      const next = [completed, ...history].slice(0, 30);
      setRun(completed); setHistory(next); setTab('results');
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); }
      catch { setNotice('Đã tính xong nhưng không lưu được lịch sử. Hãy tải kết quả JSON để giữ lần chạy này.'); }
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }

  function addToNotebook() {
    if (!run || !result) return;
    const stamp = new Date().toISOString();
    const session: ResearchSession = {
      id: crypto.randomUUID(), title: `Dự báo mưa — ${run.station}`, description: `${MODEL_NAMES[result.model]} · ${result.horizon} tháng · lần chạy ${run.id}`,
      created_at: stamp, updated_at: stamp, tags: ['dự báo', run.station],
      blocks: [
        { id: crypto.randomUUID(), type: 'dataset_methodology', title: 'Dữ liệu và phương pháp', created_at: stamp, updated_at: stamp,
          content: `Giai đoạn nguồn: ${result.trainFrom} → ${result.trainTo}.\n${result.validMonths} tháng đầy đủ; ${result.excludedMonths} tháng thiếu/không trọn tháng bị loại. Không bù dữ liệu thiếu. Tháng đầy đủ gần nhất: ${result.lastValidMonth}.\nKiểm thử tại tối đa 12 mốc gần nhất có đủ quan trắc; mỗi lần chỉ học dữ liệu trước mốc dự báo. Tháng kiểm thử: ${result.backtest[0].date} → ${result.backtest[result.backtest.length - 1].date}.\nRidge dùng α = 1, đặc trưng xu hướng và ba cặp sin/cos chu kỳ năm; mô hình đối chiếu dùng trung bình cùng tháng. Các tháng cuối bị thiếu có thể làm sai số dự báo cao hơn sai số kiểm thử.\n\nDấu vân tay SHA-256 nguồn:\n${run.sources.map(source => `${source.name}: ${source.sha256}`).join('\n')}` },
        { id: crypto.randomUUID(), type: 'statistical_results', title: 'Kết quả kiểm thử và dự báo', created_at: stamp, updated_at: stamp,
          content: `MAE: ${number(result.metrics.mae)} mm; RMSE: ${number(result.metrics.rmse)} mm; MAPE: ${number(result.metrics.mape)}%; R²: ${number(result.metrics.r2)}.\n${result.metrics.n} cặp dự báo/quan trắc.\n\n${result.forecast.map(point => `${point.date}: ${number(point.predicted)} mm; khoảng sai số thực nghiệm ${number(point.lower)}–${number(point.upper)} mm`).join('\n')}\n\nKhoảng sai số lấy phân vị 90% sai số tuyệt đối kiểm thử, không bảo đảm xác suất bao phủ. Dự báo thống kê theo tháng, không phải cảnh báo thời tiết.` },
      ],
    };
    try { saveResearchSession(session); setNotice('Đã thêm phiên nghiên cứu vào Sổ tay & báo cáo.'); }
    catch (reason) { setError(`Không lưu được sổ tay: ${String(reason)}`); }
  }

  return <div className="space-y-4 max-w-[1400px]">
    <div><div className="flex items-center gap-2.5"><FlaskConical size={22} className="text-cyan-600" /><h1 className="text-xl font-bold text-slate-800">AI Research Lab</h1><Badge color="blue">Huấn luyện từ dữ liệu CSV</Badge></div><p className="text-sm mt-1 text-slate-500">Dự báo lượng mưa theo tháng, kiểm thử theo thời gian và lưu kết quả nghiên cứu.</p></div>
    {error && <div role="alert" className="rounded-lg p-3 bg-red-50 text-red-700 text-sm">{error}</div>}
    {notice && <div role="status" className="rounded-lg p-3 bg-blue-50 text-blue-700 text-sm">{notice} <Link to="/notebook" className="underline">Mở sổ tay</Link></div>}
    <div className="grid grid-cols-3 gap-5">
      <div className="space-y-4">
        <Card className="p-4"><SectionHeader title="Cấu hình thí nghiệm" /><div className="space-y-3">
          <Select label="Trạm nghiên cứu" value={station} onChange={setStation} options={stations.map(row => ({ value: row.station_name, label: row.station_name }))} />
          <p className="text-xs text-slate-500">Biến mục tiêu: tổng lượng mưa tháng (mm). Chỉ dùng tháng có đủ ngày mưa hợp lệ.</p>
          <Select label="Mô hình" value={model} onChange={value => setModel(value as ResearchModel)} options={Object.entries(MODEL_NAMES).map(([value, label]) => ({ value, label }))} />
          <Select label="Thời hạn dự báo" value={String(horizon)} onChange={value => setHorizon(Number(value))} options={[1, 2, 3].map(value => ({ value: String(value), label: `${value} tháng` }))} />
          <p className="text-xs text-slate-500">Mỗi lần chạy tính cả hai mô hình trên cùng tập kiểm thử. Cần tối thiểu 36 tháng đầy đủ và 6 mẫu kiểm thử cho mỗi hạn.</p>
          <Button className="w-full justify-center" disabled={busy || !station} onClick={() => void handleRun()}><Play size={14} />{busy ? 'Đang tính toán…' : 'Huấn luyện & đánh giá'}</Button>
        </div></Card>
        <Card className="p-4 text-xs text-slate-600 space-y-2"><strong>{MODEL_NAMES[model]}</strong><p>{model === 'Ridge' ? 'Hồi quy có điều chuẩn (α = 1), học xu hướng và ba cặp đặc trưng chu kỳ năm từ dữ liệu trạm.' : 'Dự báo bằng trung bình lượng mưa của cùng tháng trong các năm thuộc tập huấn luyện.'}</p><p>Không nội suy tháng thiếu. Tổng mưa cực lớn đủ kỳ vẫn giữ theo nguồn, chưa được xác thực độc lập.</p><p>SARIMA và XGBoost chưa được triển khai; không hiển thị kết quả giả lập cho hai mô hình này.</p></Card>
      </div>
      <div className="col-span-2 space-y-4">
        <Card className="overflow-hidden"><div className="px-4 pt-4 border-b border-slate-200"><Tabs tabs={[{ id: 'results', label: 'Kết quả dự báo', icon: <TrendingUp size={14} /> }, { id: 'metrics', label: 'Đánh giá mô hình', icon: <BarChart2 size={14} /> }, { id: 'history', label: 'Lịch sử thí nghiệm', icon: <History size={14} /> }]} activeTab={tab} onChange={setTab} /></div>
          <div className="p-4 space-y-4">
            {tab !== 'history' && !result && <p className="py-16 text-center text-slate-500">Chọn trạm và nhấn “Huấn luyện & đánh giá” để tính kết quả.</p>}
            {tab === 'results' && run && result && <>
              <h2 className="font-semibold text-slate-800">{run.station} · {MODEL_NAMES[result.model]} · {result.horizon} tháng</h2>
              <p className="text-xs text-slate-500">Lần chạy {new Date(run.createdAt).toLocaleString('vi-VN')}. Nguồn {result.trainFrom} → {result.trainTo}; {result.validMonths} tháng dùng được, {result.excludedMonths} tháng loại. Tháng đầy đủ gần nhất: {result.lastValidMonth}. Dự báo bắt đầu sau tháng cuối của bộ dữ liệu.</p>
              {result.lastValidMonth !== result.trainTo && <p className="rounded p-3 text-xs bg-amber-50 text-amber-900">Các tháng cuối nguồn không đủ quan trắc để học. Mô hình dùng lịch sử đầy đủ đến {result.lastValidMonth}; sai số kiểm thử trên những giai đoạn đầy đủ có thể thấp hơn sai số dự báo hiện tại.</p>}
              <ForecastChart historical={result.historical.map(row => ({ label: row.date, value: row.value }))} forecast={result.forecast.map(row => ({ label: row.date, ...row }))} metric="rainfall_mm" />
              <div className="grid grid-cols-3 gap-3">{result.forecast.map(point => <div key={point.date} className="rounded-lg p-3 bg-slate-50 border border-slate-200 text-center"><p className="text-xs text-slate-500">{point.date}</p><p className="text-xl font-bold text-cyan-700">{number(point.predicted)} mm</p><p className="text-xs text-slate-500">{number(point.lower)}–{number(point.upper)} mm</p></div>)}</div>
              <p className="text-xs text-slate-500">Dải sai số lấy phân vị 90% sai số tuyệt đối của các lần kiểm thử cùng hạn. Đây là khoảng thực nghiệm trên mẫu nhỏ, không phải khoảng tin cậy đã hiệu chuẩn.</p>
              <div className="flex gap-2"><Button variant="secondary" onClick={() => downloadText(`thi-nghiem-${run.id}.json`, JSON.stringify(run, null, 2), 'application/json')}>Tải kết quả JSON</Button><Button onClick={addToNotebook}>Thêm vào sổ tay</Button></div>
            </>}
            {tab === 'metrics' && run && result && <>
              <p className="text-sm text-slate-600">{run.station} · 12 mốc gần nhất có đủ quan trắc để kiểm thử (hoặc ít hơn nếu nguồn thiếu), mỗi mốc chỉ học từ quá khứ. Tháng kiểm thử: {result.backtest[0].date} → {result.backtest[result.backtest.length - 1].date}. MAPE bỏ các quan trắc bằng 0; R² không xác định nếu quan trắc không biến thiên.</p>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Mô hình', 'Số mẫu', 'MAE (mm)', 'RMSE (mm)', 'MAPE (%)', 'R²'].map(label => <th key={label} className="text-left p-2 border-b">{label}</th>)}</tr></thead><tbody>{run.results.map(item => <tr key={item.model}><td className="p-2">{MODEL_NAMES[item.model]}</td><td>{item.metrics.n}</td><td>{number(item.metrics.mae)}</td><td>{number(item.metrics.rmse)}</td><td>{number(item.metrics.mape)} ({item.metrics.mape_n} mẫu)</td><td>{number(item.metrics.r2)}</td></tr>)}</tbody></table></div>
              <p className="text-xs text-slate-500">Theo hạn của {MODEL_NAMES[result.model]}: {result.metricsByLead.map(item => `${item.lead} tháng: MAE ${number(item.mae)} mm (${item.n} mẫu)`).join(' · ')}</p>
              <details><summary className="text-sm cursor-pointer">Xem từng dự báo kiểm thử</summary><div className="overflow-auto max-h-80"><table className="w-full text-xs"><thead><tr>{['Mốc học đến', 'Tháng kiểm thử', 'Hạn', 'Quan trắc', 'Dự báo'].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>{result.backtest.map(point => <tr key={`${point.origin}:${point.lead}`}><td className="p-2">{point.origin}</td><td>{point.date}</td><td>{point.lead}</td><td>{number(point.actual)}</td><td>{number(point.predicted)}</td></tr>)}</tbody></table></div></details>
            </>}
            {tab === 'history' && <><p className="text-xs text-slate-500">Giữ tối đa 30 lần chạy trên trình duyệt này. Mỗi lần lưu cấu hình và dấu vân tay bộ CSV; kết quả cũ không thay đổi khi nhập nguồn mới.</p>{!history.length && <p className="py-12 text-center text-slate-500">Chưa có lần chạy nào.</p>}{history.map(item => <button key={item.id} className="w-full text-left rounded-lg p-3 border border-slate-200 hover:bg-slate-50" onClick={() => { setRun(item); setTab('results'); }}><span className="font-medium text-sm">{item.station} · {MODEL_NAMES[item.selected]}</span><p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('vi-VN')} · mở kết quả đã lưu</p></button>)}</>}
          </div>
        </Card>
        <Card className="p-4 text-xs text-slate-600">Kết quả phục vụ nghiên cứu thống kê từ dữ liệu lịch sử. Không dùng thay dự báo thời tiết hoặc cảnh báo lũ thời gian thực.</Card>
      </div>
    </div>
  </div>;
}
