import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { SOURCE_FILES, normalizeDatasetCore, createTransportDataset } from '../src/services/csvNormalization.ts';
import type { SourceFileName } from '../src/services/csvNormalization.ts';
export { SOURCE_FILES, createTransportDataset, normalizeDateLabel, normalizeRiverDatetime, parseCsv } from '../src/services/csvNormalization.ts';
export type { SourceFileName } from '../src/services/csvNormalization.ts';

export function normalizeDataset(sources: Partial<Record<SourceFileName, string>>) {
  const hashes = Object.fromEntries(Object.entries(sources).filter(([, text]) => text !== undefined).map(([name, text]) => [name, createHash('sha256').update(text!, 'utf8').digest('hex')]));
  return normalizeDatasetCore(sources, hashes);
}

/** Never delete the previous target; retry short-lived Windows reader locks only. */
export async function writeJsonAtomically(
  outputFile: string,
  contents: string,
  renameFile: (from: string, to: string) => Promise<void> = rename,
  wait: (milliseconds: number) => Promise<unknown> = delay,
) {
  // Identical inputs should not trigger a Vite reload or replace a file held open by Windows.
  const previous = await readFile(outputFile, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (previous === contents) return;
  const temporaryFile = `${outputFile}.${process.pid}.${randomUUID()}.tmp`;
  // Exclusive creation establishes ownership of this exact temporary file.
  const handle = await open(temporaryFile, 'wx');
  try {
    try { await handle.writeFile(contents, 'utf8'); }
    finally { await handle.close(); }
    const delays = [150, 300, 600, 1200]; // Five attempts, at most 2.25 seconds of backoff.
    for (let attempt = 0; ; attempt++) {
      try {
        await renameFile(temporaryFile, outputFile);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt >= delays.length || !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '')) throw error;
        await wait(delays[attempt]);
      }
    }
  } finally {
    // The file is absent after successful rename. Never remove the target itself.
    await unlink(temporaryFile).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

/** Read all sources before writing; validation failure leaves the last artifact untouched. */
export async function processData(options: { rawDirectory?: string; outputFile?: string } = {}) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const rawDirectory = options.rawDirectory ?? path.join(projectRoot, 'data', 'raw');
  const outputFile = options.outputFile ?? path.join(projectRoot, 'public', 'data', 'normalized_dataset.json');
  const reads = await Promise.allSettled(SOURCE_FILES.map(name => readFile(path.join(rawDirectory, name), 'utf8')));
  const failures = reads.flatMap((read, index) => read.status === 'rejected' ? [SOURCE_FILES[index]] : []);
  if (failures.length) throw new Error(`Không đọc được CSV bắt buộc trong ${rawDirectory}: ${failures.join(', ')}`);
  const sources = Object.fromEntries(reads.map((read, index) => [SOURCE_FILES[index], read.status === 'fulfilled' ? read.value : '']));
  const dataset = normalizeDataset(sources);
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeJsonAtomically(outputFile, `${JSON.stringify(createTransportDataset(dataset))}\n`);
  return dataset;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  processData().then(dataset => {
    console.log(`Đã chuẩn hóa ${dataset.daily_records.length.toLocaleString('en-US')} dòng khí tượng, ${dataset.quality_records.length.toLocaleString('en-US')} dòng chất lượng và ${dataset.river_records.length} dòng mực nước.`);
    console.log(`Ghép chất lượng: ${dataset.manifest.matched_quality_rows}; chưa ghép: ${dataset.manifest.unmatched_daily_rows} khí tượng / ${dataset.manifest.unmatched_quality_rows} chất lượng.`);
    dataset.manifest.warnings.forEach(warning => console.warn(`Cảnh báo: ${warning}`));
  }).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
