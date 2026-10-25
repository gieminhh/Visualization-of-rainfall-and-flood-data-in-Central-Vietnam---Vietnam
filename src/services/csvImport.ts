import { SOURCE_FILES, normalizeDatasetCore } from './csvNormalization.ts';
import type { SourceFileName } from './csvNormalization.ts';
import type { NormalizedDataset } from '../types/index.ts';

export async function prepareCsvImport(files: Pick<File, 'name' | 'arrayBuffer'>[]): Promise<NormalizedDataset> {
  const sources: Partial<Record<SourceFileName, string>> = {};
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const name = SOURCE_FILES.find(item => item.toLowerCase() === file.name.toLowerCase());
    if (!name) throw new Error(`Tệp không thuộc bộ dữ liệu: ${file.name}`);
    if (sources[name] !== undefined) throw new Error(`Tệp trùng: ${name}`);
    const bytes = await file.arrayBuffer();
    sources[name] = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    hashes[name] = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  }
  const missing = SOURCE_FILES.filter(name => sources[name] === undefined);
  if (missing.length) throw new Error(`Chọn đủ 6 CSV liên quan để kiểm tra chéo. Còn thiếu: ${missing.join(', ')}`);
  return normalizeDatasetCore(sources, hashes) as NormalizedDataset;
}
