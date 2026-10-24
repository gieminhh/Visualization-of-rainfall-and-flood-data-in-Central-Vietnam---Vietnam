import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Papa from 'papaparse';
import { SOURCE_FILES, createTransportDataset, normalizeDataset, normalizeDateLabel, normalizeRiverDatetime, parseCsv, processData, writeJsonAtomically } from '../scripts/process-data.ts';
import type { SourceFileName } from '../scripts/process-data.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = Object.fromEntries(SOURCE_FILES.map(name => [name, readFileSync(path.join(projectRoot, 'data', 'raw', name), 'utf8')])) as Record<SourceFileName, string>;
const actual = normalizeDataset(sources);

// Deliberately tiny test-only input; the checked-in research sources are never changed.
const fixture = { ...sources };
for (const name of ['Dataset_ngay.csv', 'Chat_luong.csv'] as const) {
  fixture[name] = Papa.unparse(parseCsv(name, fixture[name]).slice(0, 1));
}
function mutate(file: SourceFileName, change: (rows: Record<string, string>[]) => void) {
  const copy = { ...fixture };
  const rows = parseCsv(file, copy[file]);
  change(rows);
  copy[file] = Papa.unparse(rows);
  return copy;
}

test('all six CSV row counts are preserved and every weather row has its exact quality match', () => {
  const expected = { 'Dataset_ngay.csv': 48187, 'Tram_do.csv': 13, 'Tinh_thanh.csv': 14, 'Muc_nuoc_ban_tin.csv': 103, 'Chat_luong.csv': 48187, 'Mo_ta.csv': 35 };
  assert.deepEqual(actual.manifest.source_rows, expected);
  assert.deepEqual(actual.manifest.output_rows, { daily_records: 48187, quality_records: 48187, stations: 13, provinces: 14, river_records: 103, descriptions: 35 });
  assert.equal(actual.manifest.matched_quality_rows, 48187);
  assert.equal(actual.manifest.unmatched_quality_rows, 0);
  assert.equal(actual.manifest.unmatched_daily_rows, 0);
  for (const record of actual.daily_records) {
    assert.ok(record.quality);
    assert.equal(record.quality.datetime, record.datetime);
    assert.equal(record.quality.station_name, record.station_name);
    assert.equal(record.quality.source_station_id, record.source_station_id);
  }
});

test('manifest hashes match the original bytes and provenance resolves to the right raw row', () => {
  for (const file of actual.manifest.source_files) {
    const buffer = readFileSync(path.join(projectRoot, 'data', 'raw', file.name));
    assert.equal(createHash('sha256').update(buffer).digest('hex'), file.sha256);
    assert.equal(parseCsv(file.name, sources[file.name]).length, file.rows);
  }
  const rawDaily = parseCsv('Dataset_ngay.csv', sources['Dataset_ngay.csv']);
  for (const record of actual.daily_records) {
    const raw = rawDaily[record.source_row - 2];
    assert.equal(raw.station_name, record.station_name);
    assert.equal(raw.datetime, record.raw_values.datetime);
    assert.equal(normalizeDateLabel(raw.datetime), record.datetime);
    for (const metric of ['rainfall_mm', 'temperature_c', 'humidity_pct', 'river_level_m'] as const) {
      assert.equal(record[metric], raw[metric] === '' ? null : Number(raw[metric]));
    }
  }
});

test('all seven extreme rainfall values are retained and require review, never verification', () => {
  const extremes = actual.daily_records.filter(record => record.rainfall_mm !== null && record.rainfall_mm >= 500);
  assert.equal(extremes.length, 7);
  for (const record of extremes) {
    assert.equal(record.quality_status, 'requires_review');
    assert.ok(record.quality_issues.includes('EXTREME_GE_500MM_REQUIRES_CHECK'));
    assert.equal(record.rainfall_mm, record.quality?.precip_reported_mm);
  }
  assert.equal(extremes.find(record => record.datetime === '2021-03-13' && record.station_name === 'Đồng Hới')?.rainfall_mm, 872.9);
});

test('indexed transport round trips exact quality matches and preserves unmatched null', () => {
  const encoded = createTransportDataset(actual);
  assert.equal(encoded.manifest.schema_version, '1.1.0');
  assert.equal(encoded.manifest.quality_encoding, 'indexed-v1');
  assert.equal(encoded.daily_records.length, actual.daily_records.length);
  for (const [index, record] of encoded.daily_records.entries()) {
    assert.equal('quality' in record, false);
    assert.notEqual(record.quality_index, null);
    assert.strictEqual(encoded.quality_records[record.quality_index!], actual.daily_records[index].quality);
  }
  const unmatched = createTransportDataset(normalizeDataset(mutate('Chat_luong.csv', rows => { rows[0].source_station_id = 'UNKNOWN'; })));
  const roundTrip = JSON.parse(JSON.stringify(unmatched)) as typeof unmatched;
  assert.equal(roundTrip.daily_records[0].quality_index, null);
  assert.equal(roundTrip.quality_records.length, 1);
  assert.equal(roundTrip.manifest.unmatched_daily_rows, 1);
});

test('blank measurements become null and observed zero remains exactly zero', () => {
  const zero = normalizeDataset(fixture).daily_records[0];
  assert.equal(zero.rainfall_mm, 0);
  assert.equal(zero.river_level_m, null);
  const blank = normalizeDataset(mutate('Dataset_ngay.csv', rows => {
    rows[0].rainfall_mm = '   ';
    rows[0].temperature_c = '';
    rows[0].humidity_pct = '';
  })).daily_records[0];
  assert.equal(blank.rainfall_mm, null);
  assert.equal(blank.temperature_c, null);
  assert.equal(blank.humidity_pct, null);
});

test('invalid rain is excluded without discarding valid temperature or the raw value', () => {
  const record = normalizeDataset(mutate('Dataset_ngay.csv', rows => { rows[0].rainfall_mm = '-2'; })).daily_records[0];
  assert.equal(record.rainfall_mm, null);
  assert.equal(record.temperature_c, 18.2);
  assert.equal(record.raw_values.rainfall_mm, '-2');
  assert.equal(record.quality_status, 'invalid');
});

test('only confirmed D/F/G/24 rainfall periods may enter the normalized daily metric', () => {
  for (const flag of ['D', 'F', 'G', '24']) {
    const record = normalizeDataset(mutate('Chat_luong.csv', rows => { rows[0].precip_flag = flag; })).daily_records[0];
    assert.equal(record.rainfall_mm, 0, flag);
  }
  for (const flag of ['A', 'B', 'C', 'E', 'H', 'I', '']) {
    const record = normalizeDataset(mutate('Chat_luong.csv', rows => { rows[0].precip_flag = flag; })).daily_records[0];
    assert.equal(record.rainfall_mm, null, flag);
    assert.equal(record.temperature_c, 18.2);
    assert.equal(record.raw_values.rainfall_mm, '0');
  }
  const partial = normalizeDataset(mutate('Chat_luong.csv', rows => { rows[0].precip_status = 'PARTIAL_PERIOD_EXCLUDED'; })).daily_records[0];
  assert.equal(partial.rainfall_mm, null);
});

test('humidity needs at least four valid hours; invalid humidity does not change temperature', () => {
  const record = normalizeDataset(mutate('Chat_luong.csv', rows => { rows[0].humidity_n_hours = '3'; })).daily_records[0];
  assert.equal(record.humidity_pct, null);
  assert.equal(record.temperature_c, 18.2);
  assert.equal(record.raw_values.humidity_pct, '78.511');
});

test('quality joins require the complete day, station name and source ID', () => {
  for (const [field, value] of [['source_station_id', 'UNKNOWN'], ['station_name', 'UNKNOWN'], ['datetime', '2016-01-02 00:00:00']]) {
    const dataset = normalizeDataset(mutate('Chat_luong.csv', rows => { rows[0][field] = value; }));
    const record = dataset.daily_records[0];
    assert.equal(record.quality, null, field);
    assert.equal(record.quality_status, 'unmatched');
    assert.equal(record.rainfall_mm, null);
    assert.equal(record.temperature_c, 18.2);
    assert.equal(dataset.manifest.unmatched_daily_rows, 1);
    assert.equal(dataset.manifest.unmatched_quality_rows, 1);
    assert.equal(dataset.quality_records.length, 1);
  }
});

test('missing files, malformed headers/dates and duplicate keys fail clearly', () => {
  assert.throws(() => normalizeDataset({ ...fixture, 'Mo_ta.csv': undefined }), /Mo_ta.csv/);
  assert.throws(() => parseCsv('Dataset_ngay.csv', 'wrong\nvalue'), /thiếu cột/);
  assert.throws(() => normalizeDateLabel('2026-02-30 00:00:00'), /ngoài phạm vi/);
  assert.throws(() => normalizeDateLabel('2026-01-01 01:00:00'), /00:00:00/);
  assert.throws(() => normalizeDataset(mutate('Dataset_ngay.csv', rows => { rows[0].datetime = 'not a date'; })), /ngày giờ không hợp lệ/);
  assert.throws(() => normalizeDataset(mutate('Dataset_ngay.csv', rows => { rows.push({ ...rows[0] }); })), /khóa trùng lặp/);
  assert.throws(() => normalizeDataset(mutate('Chat_luong.csv', rows => { rows.push({ ...rows[0] }); })), /khóa trùng lặp/);
});

test('river times retain local UTC+7 instants without merging into the UTC day labels', () => {
  assert.equal(normalizeRiverDatetime('2016-02-13 19:00:00', 'Asia/Ho_Chi_Minh'), '2016-02-13T19:00:00+07:00');
  assert.equal(new Date(normalizeRiverDatetime('2016-02-13 01:00:00', 'Asia/Ho_Chi_Minh')).toISOString(), '2016-02-12T18:00:00.000Z');
  assert.throws(() => normalizeRiverDatetime('2016-02-13 19:00:00', 'UTC'), /múi giờ/);
  assert.throws(() => normalizeRiverDatetime('2016-02-13', 'Asia/Ho_Chi_Minh'), /giờ quan trắc gốc/);
  assert.throws(() => normalizeDataset(mutate('Muc_nuoc_ban_tin.csv', rows => { rows[0].datetime = '2016-02-13'; })), /giờ quan trắc gốc/);
  for (const river of actual.river_records) {
    assert.match(river.datetime, /\+07:00$/);
    assert.equal(river.datetime.slice(0, 10), river.original_datetime.slice(0, 10));
    assert.equal(river.longitude, null);
    assert.equal(river.latitude, null);
  }
  assert.ok(actual.daily_records.every(record => record.river_level_m === null && record.datetime.length === 10));
});

test('identical generated contents avoid file replacement and unnecessary Windows lock failures', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'central-flood-unchanged-'));
  const outputFile = path.join(directory, 'dataset.json');
  try {
    await writeFile(outputFile, 'same dataset');
    await writeJsonAtomically(outputFile, 'same dataset', async () => { throw new Error('Must not rename identical output'); });
    assert.equal(await readFile(outputFile, 'utf8'), 'same dataset');
    assert.deepEqual(await readdir(directory), ['dataset.json']);
  } finally {
    await unlink(outputFile);
    await rmdir(directory);
  }
});

test('atomic writes retry transient Windows locks then replace the target without temporary files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'central-flood-atomic-'));
  const outputFile = path.join(directory, 'dataset.json');
  let attempts = 0;
  const waits: number[] = [];
  try {
    await writeFile(outputFile, 'previous dataset');
    await writeJsonAtomically(outputFile, 'new dataset', async (from, to) => {
      const code = ['EPERM', 'EBUSY', 'EACCES'][attempts++];
      if (code) throw Object.assign(new Error('simulated transient file lock'), { code });
      await rename(from, to);
    }, async milliseconds => { waits.push(milliseconds); });
    assert.equal(attempts, 4);
    assert.deepEqual(waits, [150, 300, 600]);
    assert.equal(await readFile(outputFile, 'utf8'), 'new dataset');
    assert.deepEqual(await readdir(directory), ['dataset.json']);
  } finally {
    await unlink(outputFile);
    await rmdir(directory);
  }
});

test('exhausted or permanent atomic-write failure keeps the previous target and cleans only its temporary file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'central-flood-atomic-'));
  const outputFile = path.join(directory, 'dataset.json');
  const unrelatedFile = path.join(directory, 'unrelated.tmp');
  try {
    await writeFile(outputFile, 'previous dataset');
    await writeFile(unrelatedFile, 'untouched');
    for (const code of ['EPERM', 'EIO']) {
      let attempts = 0;
      const waits: number[] = [];
      await assert.rejects(writeJsonAtomically(outputFile, 'new dataset', async () => {
        attempts++;
        throw Object.assign(new Error(`simulated ${code}`), { code });
      }, async milliseconds => { waits.push(milliseconds); }), new RegExp(code));
      assert.equal(attempts, code === 'EPERM' ? 5 : 1);
      assert.deepEqual(waits, code === 'EPERM' ? [150, 300, 600, 1200] : []);
      assert.ok(waits.reduce((sum, value) => sum + value, 0) < 4000);
      assert.equal(await readFile(outputFile, 'utf8'), 'previous dataset');
      assert.equal(await readFile(unrelatedFile, 'utf8'), 'untouched');
      assert.deepEqual((await readdir(directory)).sort(), ['dataset.json', 'unrelated.tmp']);
    }
  } finally {
    await unlink(outputFile);
    await unlink(unrelatedFile);
    await rmdir(directory);
  }
});

test('failed processing never overwrites the last valid artifact', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'central-flood-ingestion-'));
  const outputFile = path.join(directory, 'last-valid.json');
  const created: string[] = [];
  try {
    await writeFile(outputFile, 'last valid artifact');
    created.push(outputFile);
    await assert.rejects(processData({ rawDirectory: directory, outputFile }), /CSV bắt buộc/);
    assert.equal(await readFile(outputFile, 'utf8'), 'last valid artifact');
    for (const file of SOURCE_FILES) {
      const filename = path.join(directory, file);
      await writeFile(filename, file === 'Dataset_ngay.csv' ? 'bad_header\nbad_value' : fixture[file]);
      created.push(filename);
    }
    await assert.rejects(processData({ rawDirectory: directory, outputFile }), /thiếu cột/);
    assert.equal(await readFile(outputFile, 'utf8'), 'last valid artifact');
  } finally {
    await Promise.all(created.map(filename => unlink(filename)));
    await rmdir(directory);
  }
});
