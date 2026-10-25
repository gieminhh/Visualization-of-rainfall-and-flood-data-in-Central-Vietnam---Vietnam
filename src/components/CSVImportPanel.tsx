import { useState } from 'react';
import { Button } from './ui';
import { prepareCsvImport } from '../services/csvImport';
import { SOURCE_FILES } from '../services/csvNormalization';
import { datasetStorage } from '../services/datasetStorage';
import type { NormalizedDataset } from '../types';

export default function CSVImportPanel() {
  const [candidate, setCandidate] = useState<NormalizedDataset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function selectFiles(files: File[]) {
    setBusy(true); setError(''); setCandidate(null); setMessage('Đang kiểm tra giá trị, liên kết trạm/ngày và cờ chất lượng…');
    try { setCandidate(await prepareCsvImport(files)); setMessage('Kiểm tra xong. Xem thông tin trước khi áp dụng.'); }
    catch (reason) { setError(String(reason)); setMessage(''); }
    finally { setBusy(false); }
  }
  async function apply(reset = false) {
    setBusy(true); setError('');
    try {
      if (reset) await datasetStorage('clear');
      else if (candidate) await datasetStorage('write', { ...candidate, manifest: { ...candidate.manifest, imported_at: new Date().toISOString() } });
      else throw new Error('Chưa có bộ dữ liệu hợp lệ.');
      // Reload every consumer and its filters after the durable transaction completes.
      window.location.reload();
    } catch (reason) { setError(`Không cập nhật được dữ liệu: ${String(reason)}`); setBusy(false); }
  }
  return <div className="space-y-4 text-sm">
    <p>Chọn đủ 6 CSV để thay bộ dữ liệu đang phân tích. Dữ liệu được kiểm tra bằng cùng quy trình xử lý của dự án, lưu trên trình duyệt này và giữ sau khi tải lại trang.</p>
    <p className="text-xs text-slate-500">{SOURCE_FILES.join(' · ')}</p>
    <input aria-label="Chọn bộ 6 CSV" type="file" accept=".csv" multiple disabled={busy} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) void selectFiles(files); e.target.value = ''; }} />
    {message && <p role="status" className="text-cyan-700">{message}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {candidate && <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <p className="font-semibold">{candidate.daily_records.length.toLocaleString('vi-VN')} bản ghi · {candidate.stations.length} trạm · {candidate.manifest.date_range.from} → {candidate.manifest.date_range.to}</p>
      <p>{candidate.manifest.matched_quality_rows.toLocaleString('vi-VN')} dòng ghép được chất lượng; {candidate.manifest.unmatched_daily_rows} dòng chưa ghép.</p>
      {candidate.manifest.warnings.map((warning, i) => <p key={i} className="text-xs text-amber-800">{warning}</p>)}
      <Button disabled={busy} onClick={() => void apply()}>Áp dụng bộ dữ liệu này</Button>
    </div>}
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs text-slate-500">Áp dụng sẽ thay toàn bộ bộ dữ liệu trong trình duyệt, không ghép thêm dòng. CSV gốc của dự án vẫn được giữ. Các tab đang mở khác cần tải lại. Dữ liệu không đồng bộ sang máy khác.</p>
      <Button variant="secondary" disabled={busy} onClick={() => void apply(true)}>Dùng lại dữ liệu gốc của dự án</Button>
    </div>
  </div>;
}
