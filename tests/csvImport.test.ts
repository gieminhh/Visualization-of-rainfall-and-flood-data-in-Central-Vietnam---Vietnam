import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';
import { SOURCE_FILES, normalizeDataset } from '../scripts/process-data.ts';
import { prepareCsvImport } from '../src/services/csvImport.ts';
import { datasetStorage } from '../src/services/datasetStorage.ts';
import { createDataService } from '../src/services/dataService.ts';

const files = SOURCE_FILES.map(name => ({ name,
  text: () => readFile(new URL(`../data/raw/${name}`, import.meta.url), 'utf8'),
  arrayBuffer: async () => new Uint8Array(await readFile(new URL(`../data/raw/${name}`, import.meta.url))).buffer,
}));

test('browser import is identical to CLI normalization, persists and feeds a fresh service', async () => {
  const imported = await prepareCsvImport(files);
  const sources = Object.fromEntries(await Promise.all(files.map(async file => [file.name, await file.text()])));
  assert.deepEqual(imported, normalizeDataset(sources));
  await datasetStorage('write', imported);
  const repository = createDataService(async () => (await datasetStorage('read'))!);
  assert.equal((await repository.getSummaryStats()).total_records, 48187);
  assert.equal((await repository.getDailyData({ station_name: 'Cam Ranh' })).filter(row => row.rainfall_mm !== null).length, 0);
  const reducedFiles = await Promise.all(files.map(async file => {
    const contents = await file.text();
    const selected = ['Dataset_ngay.csv', 'Chat_luong.csv'].includes(file.name)
      ? Papa.unparse(Papa.parse(contents, { header: true, skipEmptyLines: true }).data.slice(0, 1)) : contents;
    return new File([selected], file.name);
  }));
  const reduced = await prepareCsvImport(reducedFiles);
  await datasetStorage('write', reduced);
  const reloaded = createDataService(async () => (await datasetStorage('read'))!);
  assert.equal((await reloaded.getSummaryStats()).total_records, 1);
  await assert.rejects(() => prepareCsvImport(files.slice(1)), /Còn thiếu/);
  assert.equal((await datasetStorage('read'))?.daily_records.length, 1);
  await datasetStorage('clear');
  assert.equal(await datasetStorage('read'), undefined);
});

test('duplicate and malformed CSVs fail before touching active dataset', async () => {
  await assert.rejects(() => prepareCsvImport([...files, files[0]]), /Tệp trùng/);
  await assert.rejects(() => prepareCsvImport([new File(['broken\n1'], 'Dataset_ngay.csv'), ...files.slice(1)]), /thiếu cột/);
  await assert.rejects(() => prepareCsvImport([new File([''], 'unexpected.csv')]), /không thuộc/);
});

test('browser source hashes include the UTF-8 BOM bytes', async () => {
  const contents = '\uFEFF' + await files[5].text();
  const imported = await prepareCsvImport([...files.slice(0, 5), new File([contents], 'Mo_ta.csv')]);
  assert.equal(imported.manifest.source_files.find(source => source.name === 'Mo_ta.csv')?.sha256, createHash('sha256').update(contents, 'utf8').digest('hex'));
});
