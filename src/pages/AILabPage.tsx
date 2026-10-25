import { useEffect, useState, useRef } from 'react';
import { FlaskConical, Play, History, BarChart2, TrendingUp, Sparkles, Upload, FileCheck, X, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, SectionHeader, Select, Button, Badge, Tabs } from '../components/ui';
import { ForecastChart } from '../components/charts';
import { AIAssistantTab } from '../components/research/AIAssistantTab';
import { dataService } from '../services/dataService';
import { MODEL_NAMES, prepareMonths, runForecast } from '../services/forecasting';
import type { ForecastResult, ResearchModel } from '../services/forecasting';
import { downloadText, saveResearchSession } from '../services/reports';
import { parseCustomStationCsv } from '../services/customDataset';
import type { CustomStationData } from '../services/customDataset';
import type { DataManifest, ResearchSession, Station, MonthlyAggregate } from '../types';

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

  // Custom station CSV upload states
  const [customStationMap, setCustomStationMap] = useState<Map<string, MonthlyAggregate[]>>(new Map());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadStationName, setUploadStationName] = useState('');
  const [uploadFileContent, setUploadFileContent] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  const currentStationInfo = stations.find(s => s.station_name === station);

  async function handleRun() {
    setBusy(true); setError(''); setNotice(''); setRun(null);
    try {
      let rows: MonthlyAggregate[];
      if (customStationMap.has(station)) {
        rows = customStationMap.get(station)!;
      } else {
        rows = await dataService.getMonthlyData({ station_name: station });
      }

      const manifest = await dataService.getManifest();
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    setUploadError('');
    setUploadSuccess('');

    const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!uploadStationName) {
      setUploadStationName(defaultName);
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setUploadFileContent(text);
    };
    reader.onerror = () => {
      setUploadError('Không đọc được file CSV. Hãy thử lại.');
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleConfirmUpload() {
    if (!uploadFileContent) {
      setUploadError('Vui lòng chọn một file CSV trước.');
      return;
    }

    try {
      const parsed: CustomStationData = parseCustomStationCsv(uploadFileContent, uploadStationName);
      
      // Thêm trạm mới vào danh sách trạm
      setStations(prev => {
        const filtered = prev.filter(s => s.station_name !== parsed.station.station_name);
        return [parsed.station, ...filtered];
      });

      // Lưu bảng dữ liệu tháng
      setCustomStationMap(prev => {
        const next = new Map(prev);
        next.set(parsed.station.station_name, parsed.monthlyRows);
        return next;
      });

      setStation(parsed.station.station_name);
      setUploadSuccess(`Đã nạp thành công trạm "${parsed.station.station_name}" (${parsed.station.n_rows.toLocaleString()} dòng, ${parsed.monthlyRows.length} tháng).`);
      
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFileContent('');
        setUploadFileName('');
        setUploadStationName('');
        setUploadSuccess('');
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Lỗi kiểm tra cấu trúc file CSV.');
    }
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
    {/* Header trang và Nút Tải lên CSV trạm mới */}
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <FlaskConical size={22} className="text-cyan-600 dark:text-cyan-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">AI Research Lab</h1>
          <Badge color="blue">Huấn luyện từ dữ liệu CSV</Badge>
          {customStationMap.has(station) && <Badge color="green">Dữ liệu tùy chọn tải lên</Badge>}
        </div>
        <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">Dự báo lượng mưa theo tháng, kiểm thử theo thời gian và tương tác với Trợ lý AI.</p>
      </div>

      <Button
        variant="secondary"
        onClick={() => { setShowUploadModal(true); setUploadError(''); setUploadSuccess(''); }}
        className="flex items-center gap-1.5 border-dashed border-cyan-400 dark:border-cyan-600 text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
      >
        <Upload size={14} className="text-cyan-700 dark:text-cyan-400" />
        <span className="hidden sm:inline">+ Tải lên CSV trạm mới</span>
        <span className="sm:hidden">+ Tải CSV</span>
      </Button>
    </div>

    {error && <div role="alert" className="rounded-lg p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">{error}</div>}
    {notice && <div role="status" className="rounded-lg p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 text-sm">{notice} <Link to="/notebook" className="underline font-medium">Mở sổ tay</Link></div>}
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="space-y-4">
        <Card className="p-4"><SectionHeader title="Cấu hình thí nghiệm" /><div className="space-y-3">
          <Select label="Trạm nghiên cứu" value={station} onChange={setStation} options={stations.map(row => ({ value: row.station_name, label: row.province_name === 'Trạm người dùng tải lên' ? `📁 ${row.station_name} (Custom)` : row.station_name }))} />
          <p className="text-xs text-slate-500 dark:text-slate-400">Biến mục tiêu: tổng lượng mưa tháng (mm). Chỉ dùng tháng có đủ ngày mưa hợp lệ.</p>
          <Select label="Mô hình" value={model} onChange={value => setModel(value as ResearchModel)} options={Object.entries(MODEL_NAMES).map(([value, label]) => ({ value, label }))} />
          <Select label="Thời hạn dự báo" value={String(horizon)} onChange={value => setHorizon(Number(value))} options={[1, 2, 3].map(value => ({ value: String(value), label: `${value} tháng` }))} />
          <p className="text-xs text-slate-500 dark:text-slate-400">Mỗi lần chạy tính cả hai mô hình trên cùng tập kiểm thử. Cần tối thiểu 36 tháng đầy đủ và 6 mẫu kiểm thử cho mỗi hạn.</p>
          <Button className="w-full justify-center" disabled={busy || !station} onClick={() => void handleRun()}><Play size={14} />{busy ? 'Đang tính toán…' : 'Huấn luyện & đánh giá'}</Button>
        </div></Card>
        <Card className="p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2"><strong>{MODEL_NAMES[model]}</strong><p>{model === 'Ridge' ? 'Hồi quy có điều chuẩn (α = 1), học xu hướng và ba cặp đặc trưng chu kỳ năm từ dữ liệu trạm.' : 'Dự báo bằng trung bình lượng mưa của cùng tháng trong các năm thuộc tập huấn luyện.'}</p><p>Không nội suy tháng thiếu. Tổng mưa cực lớn đủ kỳ vẫn giữ theo nguồn, chưa được xác thực độc lập.</p><p>SARIMA và XGBoost chưa được triển khai; không hiển thị kết quả giả lập cho hai mô hình này.</p></Card>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <Card className="overflow-hidden"><div className="px-4 pt-4 border-b border-slate-200 dark:border-slate-800">
          <Tabs tabs={[
            { id: 'results', label: 'Kết quả dự báo', icon: <TrendingUp size={14} /> },
            { id: 'metrics', label: 'Đánh giá mô hình', icon: <BarChart2 size={14} /> },
            { id: 'ai-assistant', label: 'Hỏi đáp AI nghiên cứu', icon: <Sparkles size={14} /> },
            { id: 'history', label: 'Lịch sử thí nghiệm', icon: <History size={14} /> }
          ]} activeTab={tab} onChange={setTab} />
        </div>
          <div className="p-4 space-y-4">
            {tab !== 'history' && tab !== 'ai-assistant' && !result && <p className="py-16 text-center text-slate-500 dark:text-slate-400">Chọn trạm và nhấn “Huấn luyện & đánh giá” để tính kết quả.</p>}
            
            {tab === 'results' && run && result && <>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{run.station} · {MODEL_NAMES[result.model]} · {result.horizon} tháng</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lần chạy {new Date(run.createdAt).toLocaleString('vi-VN')}. Nguồn {result.trainFrom} → {result.trainTo}; {result.validMonths} tháng dùng được, {result.excludedMonths} tháng loại. Tháng đầy đủ gần nhất: {result.lastValidMonth}. Dự báo bắt đầu sau tháng cuối của bộ dữ liệu.</p>
              {result.lastValidMonth !== result.trainTo && <p className="rounded p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Các tháng cuối nguồn không đủ quan trắc để học. Mô hình dùng lịch sử đầy đủ đến {result.lastValidMonth}; sai số kiểm thử trên những giai đoạn đầy đủ có thể thấp hơn sai số dự báo hiện tại.</p>}
              <ForecastChart historical={result.historical.map(row => ({ label: row.date, value: row.value }))} forecast={result.forecast.map(row => ({ label: row.date, ...row }))} metric="rainfall_mm" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{result.forecast.map(point => <div key={point.date} className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center"><p className="text-xs text-slate-500 dark:text-slate-400">{point.date}</p><p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{number(point.predicted)} mm</p><p className="text-xs text-slate-500 dark:text-slate-400">{number(point.lower)}–{number(point.upper)} mm</p></div>)}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Dải sai số lấy phân vị 90% sai số tuyệt đối của các lần kiểm thử cùng hạn. Đây là khoảng thực nghiệm trên mẫu nhỏ, không phải khoảng tin cậy đã hiệu chuẩn.</p>
              <div className="flex gap-2 flex-wrap"><Button variant="secondary" onClick={() => downloadText(`thi-nghiem-${run.id}.json`, JSON.stringify(run, null, 2), 'application/json')}>Tải kết quả JSON</Button><Button onClick={addToNotebook}>Thêm vào sổ tay</Button></div>
            </>}

            {tab === 'metrics' && run && result && <>
              <p className="text-sm text-slate-600 dark:text-slate-300">{run.station} · 12 mốc gần nhất có đủ quan trắc để kiểm thử (hoặc ít hơn nếu nguồn thiếu), mỗi mốc chỉ học từ quá khứ. Tháng kiểm thử: {result.backtest[0].date} → {result.backtest[result.backtest.length - 1].date}. MAPE bỏ các quan trắc bằng 0; R² không xác định nếu quan trắc không biến thiên.</p>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Mô hình', 'Số mẫu', 'MAE (mm)', 'RMSE (mm)', 'MAPE (%)', 'R²'].map(label => <th key={label} className="text-left p-2 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{label}</th>)}</tr></thead><tbody>{run.results.map(item => <tr key={item.model} className="border-b border-slate-100 dark:border-slate-800/60"><td className="p-2 font-medium">{MODEL_NAMES[item.model]}</td><td>{item.metrics.n}</td><td>{number(item.metrics.mae)}</td><td>{number(item.metrics.rmse)}</td><td>{number(item.metrics.mape)} ({item.metrics.mape_n} mẫu)</td><td>{number(item.metrics.r2)}</td></tr>)}</tbody></table></div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Theo hạn của {MODEL_NAMES[result.model]}: {result.metricsByLead.map(item => `${item.lead} tháng: MAE ${number(item.mae)} mm (${item.n} mẫu)`).join(' · ')}</p>
              <details><summary className="text-sm cursor-pointer text-slate-700 dark:text-slate-200 font-medium">Xem từng dự báo kiểm thử</summary><div className="overflow-auto max-h-80 mt-2"><table className="w-full text-xs"><thead><tr>{['Mốc học đến', 'Tháng kiểm thử', 'Hạn', 'Quan trắc', 'Dự báo'].map(label => <th key={label} className="p-2 text-left border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{label}</th>)}</tr></thead><tbody>{result.backtest.map(point => <tr key={`${point.origin}:${point.lead}`} className="border-b border-slate-100 dark:border-slate-800/60"><td className="p-2">{point.origin}</td><td>{point.date}</td><td>{point.lead}</td><td>{number(point.actual)}</td><td>{number(point.predicted)}</td></tr>)}</tbody></table></div></details>
            </>}

            {tab === 'ai-assistant' && (
              <AIAssistantTab
                context={{
                  station,
                  model: MODEL_NAMES[model],
                  horizon,
                  result: result ? {
                    validMonths: result.validMonths,
                    metrics: {
                      mae: result.metrics.mae,
                      rmse: result.metrics.rmse,
                      mape: result.metrics.mape,
                      r2: result.metrics.r2,
                      n: result.metrics.n,
                    },
                    forecast: result.forecast.map(f => ({
                      date: f.date,
                      predicted: f.predicted,
                      lower: f.lower,
                      upper: f.upper,
                    })),
                  } : undefined,
                  stationInfo: currentStationInfo ? {
                    province_name: currentStationInfo.province_name,
                    n_rows: currentStationInfo.n_rows,
                    n_rainfall: currentStationInfo.n_rainfall,
                    climate_source: currentStationInfo.climate_source,
                  } : undefined,
                }}
              />
            )}

            {tab === 'history' && <><p className="text-xs text-slate-500">Giữ tối đa 30 lần chạy trên trình duyệt này. Mỗi lần lưu cấu hình và dấu vân tay bộ CSV; kết quả cũ không thay đổi khi nhập nguồn mới.</p>{!history.length && <p className="py-12 text-center text-slate-500">Chưa có lần chạy nào.</p>}{history.map(item => <button key={item.id} className="w-full text-left rounded-lg p-3 border border-slate-200 hover:bg-slate-50" onClick={() => { setRun(item); setTab('results'); }}><span className="font-medium text-sm">{item.station} · {MODEL_NAMES[item.selected]}</span><p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('vi-VN')} · mở kết quả đã lưu</p></button>)}</>}
          </div>
        </Card>
        <Card className="p-4 text-xs text-slate-600">Kết quả phục vụ nghiên cứu thống kê từ dữ liệu lịch sử. Không dùng thay dự báo thời tiết hoặc cảnh báo lũ thời gian thực.</Card>
      </div>
    </div>

    {/* Modal Tải lên CSV trạm mới */}
    {showUploadModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-cyan-600 dark:text-cyan-400" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Tải lên CSV trạm khí tượng mới</h3>
            </div>
            <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Tên trạm quan trắc:</label>
              <input
                type="text"
                value={uploadStationName}
                onChange={e => setUploadStationName(e.target.value)}
                placeholder="Ví dụ: Trạm Đông Hà (Quảng Trị)"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-900"
              />
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 rounded-xl p-5 sm:p-6 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
            >
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
              <FileCheck size={28} className="mx-auto text-slate-400 dark:text-slate-500 mb-2" />
              {uploadFileName ? (
                <div className="font-semibold text-cyan-800 dark:text-cyan-300">{uploadFileName}</div>
              ) : (
                <>
                  <div className="font-medium text-slate-700 dark:text-slate-200">Nhấn để chọn file CSV từ máy tính</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Yêu cầu có cột ngày (date) và cột lượng mưa (rainfall/rain/mua)</div>
                </>
              )}
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 flex items-start gap-2">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <FileCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-[11px] space-y-1">
              <div className="text-slate-700 dark:text-slate-300">💡 <strong>Quy chuẩn tương thích:</strong></div>
              <div>• File chứa chuỗi ngày tối thiểu 36 tháng để đáp ứng điều kiện backtest mô hình.</div>
              <div>• Hệ thống tự động gom nhóm tổng mưa theo tháng và đưa thẳng vào danh sách trạm nghiên cứu + Hỏi AI.</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleConfirmUpload} disabled={!uploadFileContent}>
              Xác nhận nạp trạm
            </Button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
