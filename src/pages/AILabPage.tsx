import React, { useEffect, useState } from 'react';
import {
  FlaskConical, Play, RotateCcw, History, Info,
  BarChart2, TrendingUp, AlertCircle
} from 'lucide-react';
import { Card, SectionHeader, Select, Button, Badge, Tabs, DemoBanner } from '../components/ui';
import { ForecastChart } from '../components/charts';
import { dataService } from '../services/dataService';
import { getMetricUnit, formatMonthYear } from '../utils';
import type { ModelType, ForecastHorizon, ModelMetrics, Station } from '../types';

// ─── Demo forecast data generator ─────────────────────────────────────────────
function generateDemoForecast(stationName: string, model: ModelType, horizon: ForecastHorizon) {
  // Historical: 24 tháng trước tháng demo
  const baseValues: Record<string, number[]> = {
    'Phú Bài': [120, 95, 80, 65, 70, 55, 50, 85, 160, 420, 510, 290, 110, 90, 75, 60, 65, 50, 45, 80, 150, 400, 490, 270],
    'Đà Nẵng': [80, 60, 50, 45, 55, 45, 40, 70, 135, 360, 460, 255, 75, 55, 45, 40, 50, 40, 35, 65, 125, 345, 440, 240],
    'Thanh Hóa': [130, 105, 95, 85, 95, 105, 95, 155, 185, 205, 185, 145, 125, 100, 90, 80, 90, 100, 90, 150, 180, 200, 180, 140],
    'Vinh': [115, 95, 85, 75, 85, 95, 85, 145, 175, 195, 175, 135, 110, 90, 80, 70, 80, 90, 80, 140, 170, 190, 170, 130],
  };
  const vals = baseValues[stationName] || baseValues['Phú Bài'];
  const noise = (model === 'Baseline') ? 0.3 : model === 'XGBoost' ? 0.12 : 0.15;

  const historical = vals.map((v, i) => ({
    label: formatMonthYear(2024 + Math.floor(i / 12), (i % 12) + 1),
    value: v + (Math.random() - 0.5) * v * 0.2,
  }));

  const lastVals = vals.slice(-3);
  const forecastBase = lastVals.reduce((s, v) => s + v, 0) / lastVals.length;
  const forecast = Array.from({ length: horizon }, (_, i) => {
    const pred = forecastBase * (1 + (Math.random() - 0.5) * noise);
    const uncertainty = pred * noise * (i + 1);
    return {
      label: formatMonthYear(2026, i + 10),
      predicted: Math.max(0, pred),
      lower: Math.max(0, pred - uncertainty),
      upper: pred + uncertainty,
    };
  });

  return { historical, forecast };
}

// ─── Metrics comparison table ─────────────────────────────────────────────────
const DEMO_METRICS: ModelMetrics[] = [
  { model: 'SARIMA', mae: 42.3, rmse: 58.1, mape: 18.4, r2: 0.71 },
  { model: 'XGBoost', mae: 35.8, rmse: 49.6, mape: 15.2, r2: 0.78 },
  { model: 'Baseline', mae: 68.5, rmse: 91.2, mape: 28.7, r2: 0.43 },
];

const DEMO_EXPERIMENTS = [
  { id: 'exp-001', station: 'Phú Bài', model: 'XGBoost', horizon: 3, date: '2026-10-15', mae: 35.8 },
  { id: 'exp-002', station: 'Đà Nẵng', model: 'SARIMA', horizon: 1, date: '2026-10-12', mae: 42.3 },
  { id: 'exp-003', station: 'Thanh Hóa', model: 'Baseline', horizon: 2, date: '2026-10-10', mae: 68.5 },
];

export default function AILabPage() {
  const [STATIONS, setStations] = useState<Station[]>([]);
  const [dataError, setDataError] = useState('');
  useEffect(() => {
    let active = true;
    dataService.getStations().then(stations => { if (active) setStations(stations); })
      .catch(error => { if (active) setDataError(String(error)); });
    return () => { active = false; };
  }, []);
  const [tab, setTab] = useState('config');
  const [station, setStation] = useState('Phú Bài');
  const [model, setModel] = useState<ModelType>('XGBoost');
  const [horizon, setHorizon] = useState<ForecastHorizon>(3);
  const [isRunning, setIsRunning] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { historical, forecast } = generateDemoForecast(station, model, horizon);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasResult(true);
      setTab('results');
    }, 1800);
  };

  return (
    <div className="space-y-4 max-w-[1400px]">
      {dataError && <p className="text-sm text-red-600">{dataError}</p>}
      <div>
        <div className="flex items-center gap-2.5">
          <FlaskConical size={22} style={{ color: '#0891B2' }} />
          <h1 className="text-xl font-bold" style={{ color: '#12304A' }}>AI Research Lab</h1>
          <Badge color="yellow">Mô phỏng giao diện — chưa chạy mô hình AI</Badge>
        </div>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
          Phòng thí nghiệm nghiên cứu mô hình dự báo — giao diện thử nghiệm (ML Experiment Dashboard)
        </p>
      </div>

      {/* AI Demo notice */}
      <div className="rounded-lg px-4 py-3 flex items-start gap-3"
        style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', color: '#92400E' }}>
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
        <div className="text-sm">
          <strong>Giao diện mô phỏng — Chưa huấn luyện mô hình AI thật.</strong>{' '}
          Các kết quả hiển thị là dữ liệu DEMO để minh họa quy trình nghiên cứu.
          Trong giai đoạn tiếp theo, hệ thống sẽ tích hợp backend Python (SARIMA, XGBoost) để chạy thực tế.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Config panel */}
        <div className="col-span-1 space-y-4">
          <Card className="p-4">
            <SectionHeader title="Cấu hình thí nghiệm" />
            <div className="space-y-3">
              <Select
                label="Trạm nghiên cứu"
                value={station}
                onChange={v => { setStation(v); setHasResult(false); }}
                options={STATIONS.filter(s => s.n_rows > 0).map(s => ({ value: s.station_name, label: s.station_name }))}
              />
              <Select
                label="Biến mục tiêu"
                value="rainfall_mm"
                onChange={() => {}}
                options={[{ value: 'rainfall_mm', label: 'Lượng mưa theo tháng (mm)' }]}
              />
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>Dữ liệu huấn luyện</div>
                <div className="text-xs rounded-lg border px-3 py-2" style={{ borderColor: '#E2E8F0', color: '#475569' }}>
                  2016–2024 (mô phỏng)
                </div>
              </div>
              <Select
                label="Mô hình"
                value={model}
                onChange={v => { setModel(v as ModelType); setHasResult(false); }}
                options={[
                  { value: 'SARIMA', label: 'SARIMA (Time-series)' },
                  { value: 'XGBoost', label: 'XGBoost (Gradient Boosting)' },
                  { value: 'Baseline', label: 'Baseline (Moving Average)' },
                ]}
              />
              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Thời hạn dự báo</div>
                <div className="flex gap-2">
                  {([1, 2, 3] as ForecastHorizon[]).map(h => (
                    <button
                      key={h}
                      onClick={() => { setHorizon(h); setHasResult(false); }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                      style={horizon === h
                        ? { backgroundColor: '#0891B2', color: 'white', borderColor: '#0891B2' }
                        : { backgroundColor: '#F8FAFC', color: '#64748B', borderColor: '#E2E8F0' }}
                    >
                      {h} tháng
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>Phương pháp đánh giá</div>
                <div className="text-xs rounded-lg border px-3 py-2" style={{ borderColor: '#E2E8F0', color: '#475569' }}>
                  Time-series Backtesting (mô phỏng)
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={handleRun}
                disabled={isRunning}
              >
                {isRunning ? (
                  <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> Đang chạy...</>
                ) : (
                  <><Play size={14} /> Chạy thử nghiệm (DEMO)</>
                )}
              </Button>
              {isRunning && (
                <div className="text-xs text-center" style={{ color: '#94A3B8' }}>
                  Mô phỏng quy trình — không có tính toán thật
                </div>
              )}
            </div>
          </Card>

          {/* Model info */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} style={{ color: '#0891B2' }} />
              <div className="text-sm font-semibold" style={{ color: '#1E293B' }}>Về mô hình {model}</div>
            </div>
            <div className="text-xs space-y-1.5" style={{ color: '#64748B' }}>
              {model === 'SARIMA' && <>
                <p>SARIMA (Seasonal ARIMA) là mô hình chuỗi thời gian cổ điển, phù hợp với dữ liệu có chu kỳ mùa vụ rõ ràng.</p>
                <p>Tham số: p, d, q (AR, diff, MA) + P, D, Q, s (seasonal).</p>
              </>}
              {model === 'XGBoost' && <>
                <p>XGBoost là thuật toán gradient boosting, có thể học các đặc trưng phi tuyến và tương tác phức tạp.</p>
                <p>Features: lag values, month, year, rolling stats.</p>
              </>}
              {model === 'Baseline' && <>
                <p>Baseline sử dụng trung bình trượt (moving average) làm dự báo đơn giản để so sánh với các mô hình phức tạp hơn.</p>
              </>}
            </div>
          </Card>
        </div>

        {/* Results panel */}
        <div className="col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 pt-4 border-b" style={{ borderColor: '#E2E8F0' }}>
              <Tabs
                tabs={[
                  { id: 'results', label: 'Kết quả dự báo', icon: <TrendingUp size={14} /> },
                  { id: 'metrics', label: 'Đánh giá mô hình', icon: <BarChart2 size={14} /> },
                  { id: 'history', label: 'Lịch sử thí nghiệm', icon: <History size={14} /> },
                ]}
                activeTab={tab === 'config' ? 'results' : tab}
                onChange={setTab}
              />
            </div>

            <div className="p-4">
              {(tab === 'results' || tab === 'config') && (
                <div className="space-y-4">
                  {!hasResult ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <FlaskConical size={40} style={{ color: '#CBD5E1' }} className="mb-3" />
                      <div className="font-semibold text-base" style={{ color: '#94A3B8' }}>Chưa có kết quả</div>
                      <div className="text-sm mt-1" style={{ color: '#CBD5E1' }}>Cấu hình và nhấn "Chạy thử nghiệm" để xem minh họa</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                          Dự báo lượng mưa — {station} · {model} · {horizon} tháng
                        </div>
                        <Badge color="yellow">DỮ LIỆU DEMO</Badge>
                      </div>
                      <ForecastChart
                        historical={historical}
                        forecast={forecast}
                        metric="rainfall_mm"
                      />
                      <div className="rounded-lg px-3 py-2 text-xs"
                        style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
                        ℹ️ Vùng bóng xanh là khoảng bất định dự báo (confidence interval mô phỏng).
                        Đường đứt là giá trị dự báo điểm.
                      </div>

                      {/* Forecast values */}
                      <div className="grid grid-cols-3 gap-3">
                        {forecast.map((f, i) => (
                          <div key={i} className="rounded-lg p-3 text-center"
                            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{f.label}</div>
                            <div className="text-xl font-bold mt-1" style={{ color: '#0891B2' }}>
                              {f.predicted.toFixed(1)} mm
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: '#CBD5E1' }}>
                              [{f.lower.toFixed(0)}–{f.upper.toFixed(0)}]
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === 'metrics' && (
                <div className="space-y-4">
                  <div className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                    So sánh hiệu suất mô hình
                  </div>
                  <DemoBanner />
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#E2E8F0' }}>
                    <table className="w-full text-xs">
                      <thead style={{ backgroundColor: '#F8FAFC' }}>
                        <tr>
                          {['Mô hình', 'MAE (mm)', 'RMSE (mm)', 'MAPE (%)', 'R²'].map(h => (
                            <th key={h} className="text-left px-4 py-3 font-semibold border-b"
                              style={{ color: '#475569', borderColor: '#E2E8F0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_METRICS.map((m, i) => (
                          <tr key={m.model} className="border-t hover:bg-slate-50"
                            style={{ borderColor: '#F1F5F9', backgroundColor: m.model === model ? '#F0F9FF' : '' }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: '#1E293B' }}>
                              {m.model}
                              {m.model === model && <Badge color="blue" >Đang chọn</Badge>}
                            </td>
                            <td className="px-4 py-3 font-medium"
                              style={{ color: m.mae === Math.min(...DEMO_METRICS.map(x => x.mae)) ? '#059669' : '#475569' }}>
                              {m.mae}
                            </td>
                            <td className="px-4 py-3" style={{ color: '#475569' }}>{m.rmse}</td>
                            <td className="px-4 py-3" style={{ color: '#475569' }}>{m.mape}%</td>
                            <td className="px-4 py-3 font-medium"
                              style={{ color: m.r2 && m.r2 > 0.7 ? '#059669' : '#D97706' }}>
                              {m.r2?.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg p-3 text-xs"
                    style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    ⚠️ Các chỉ số trên là dữ liệu minh họa. Giá trị thực cần được tính từ quá trình backtesting với dataset thực tế.
                  </div>
                </div>
              )}

              {tab === 'history' && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                    Lịch sử thí nghiệm (DEMO)
                  </div>
                  <div className="space-y-2">
                    {DEMO_EXPERIMENTS.map(exp => (
                      <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-shadow"
                        style={{ borderColor: '#E2E8F0', backgroundColor: '#FAFAFA' }}>
                        <FlaskConical size={16} style={{ color: '#0891B2' }} />
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: '#1E293B' }}>
                            {exp.station} · {exp.model} · {exp.horizon}M
                          </div>
                          <div className="text-xs" style={{ color: '#94A3B8' }}>
                            {exp.date} · MAE: {exp.mae} mm
                          </div>
                        </div>
                        <Badge color="slate">{exp.id}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>
                    ℹ️ Lịch sử thí nghiệm thực sẽ được lưu vào database khi tích hợp backend.
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Limitations note */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} style={{ color: '#D97706' }} />
              <div className="text-sm font-semibold" style={{ color: '#1E293B' }}>Giới hạn và lưu ý dự báo</div>
            </div>
            <ul className="text-xs space-y-1.5" style={{ color: '#64748B' }}>
              <li>• Dự báo mưa theo tháng chỉ có giá trị thống kê, không phải dự báo thời tiết thời gian thực.</li>
              <li>• Mô hình cần ít nhất 5 năm dữ liệu liên tục để ổn định (backtesting).</li>
              <li>• Hiện chưa có tích hợp biến ngoại sinh (ENSO, áp suất, gió mùa).</li>
              <li>• Kết quả dự báo có thể kém tin cậy với dữ liệu thiếu &gt;10%.</li>
              <li>• Giai đoạn này: giao diện mô phỏng — không có huấn luyện mô hình thực.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
