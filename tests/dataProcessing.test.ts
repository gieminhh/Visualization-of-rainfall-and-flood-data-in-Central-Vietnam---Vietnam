import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aggregateDaily, aggregateMonthly, aggregateYearly, calculateCompleteness, calculateSummaryStats, filterDailyRecords } from '../src/services/dataProcessing.ts';
import { createDataService } from '../src/services/dataService.ts';
import type { DailyRecord, NormalizedDataset } from '../src/types/index.ts';

// Synthetic rows below are unit-test fixtures only; never shipped as observations.
const row = (datetime: string, rainfall_mm: number | null, overrides: Partial<DailyRecord> = {}): DailyRecord => ({
  datetime, station_name: 'Test A', province_code: 1, longitude: 105, latitude: 18,
  rainfall_mm, temperature_c: null, humidity_pct: null, river_level_m: null,
  source_file: 'fixture.csv', quality_status: 'source_reported', ...overrides,
});

test('month with no valid rain returns null, including a wholly absent month', () => {
  const months = aggregateMonthly([row('2024-01-05', null)], { date_from: '2024-01-01', date_to: '2024-02-29' });
  assert.equal(months.length, 2);
  assert.equal(months[0].total_rainfall_mm, null);
  assert.equal(months[1].total_rainfall_mm, null);
  assert.equal(months[1].n_records, 0);
  assert.equal(months[1].expected_days, 29);
});

test('complete zero-rain month remains zero with 100% rainfall completeness', () => {
  const records = Array.from({ length: 31 }, (_, i) => row(`2024-01-${String(i + 1).padStart(2, '0')}`, 0));
  const [month] = aggregateMonthly(records);
  assert.equal(month.total_rainfall_mm, 0);
  assert.equal(month.completeness.rainfall_completeness_pct, 100);
  assert.equal(month.completeness.temperature_completeness_pct, 0);
});

test('standalone monthly aggregation uses the full calendar month as its default denominator', () => {
  const [month] = aggregateMonthly([row('2024-01-15', 0)]);
  assert.equal(month.expected_days, 31);
  assert.equal(month.recorded_days, 1);
  assert.equal(month.completeness.rainfall_completeness_pct, 3.23);
  assert.ok(month.warnings.length > 0);
});

test('partial year carries explicit warning; full leap year is identified', () => {
  const [partial] = aggregateYearly([row('2026-01-01', 0), row('2026-09-30', 4)]);
  assert.equal(partial.is_partial_year, true);
  assert.equal(partial.is_complete_year, false);
  assert.match(partial.warnings.join(' '), /Năm chưa đầy đủ/);
  const records = Array.from({ length: 366 }, (_, i) => row(new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10), 0, { temperature_c: 20, humidity_pct: 80 }));
  const [full] = aggregateYearly(records);
  assert.equal(full.is_partial_year, false);
  assert.equal(full.is_complete_year, true);
  assert.equal(full.expected_days, 366);
});

test('missing measurements do not bias averages; yearly means use daily sample weights', () => {
  const records = [row('2024-01-01', 0, { temperature_c: 10, humidity_pct: 60 }), row('2024-01-02', null),
    row('2024-02-01', 2, { temperature_c: 30, humidity_pct: 90 }), row('2024-02-02', null, { temperature_c: 20 })];
  const [year] = aggregateYearly(records);
  assert.equal(year.avg_temperature_c, 20);
  assert.equal(year.avg_humidity_pct, 75);
  assert.equal(year.total_rainfall_mm, 2);
  assert.equal(year.n_records, 4);
});

test('calendar denominator, recorded days and validity are separate for each station and metric', () => {
  const records = [row('2024-01-01', 0, { temperature_c: 20 }), row('2024-01-02', null, { humidity_pct: 80 }), row('2024-01-01', 2, { station_name: 'Test B' })];
  const c = calculateCompleteness(records, { date_from: '2024-01-01', date_to: '2024-01-03', station_names: ['Test A', 'Test B'] });
  assert.equal(c.expected_days, 6);
  assert.equal(c.recorded_days, 3);
  assert.equal(c.valid_rainfall_days, 2);
  assert.equal(c.valid_temperature_days, 1);
  assert.equal(c.valid_humidity_days, 1);
  assert.equal(c.rainfall_completeness_pct, 33.33);
  assert.equal(calculateCompleteness([]).rainfall_completeness_pct, null);
});

test('filters intersect station, province and inclusive exact dates and retain null metrics', () => {
  const records = [row('2024-01-01', 1), row('2024-02-01', null), row('2024-02-02', 3), row('2024-02-01', 4, { station_name: 'Test B', province_code: 2 })];
  assert.deepEqual(filterDailyRecords(records, { station_name: 'Test A', date_from: '2024-02-01', date_to: '2024-02-01', metric: 'rainfall_mm' }), [records[1]]);
  assert.equal(filterDailyRecords(records, { station_name: 'Test A', province_code: 2 }).length, 0);
  assert.equal(filterDailyRecords(records, { date_from: '2024', date_to: '2024' }).length, 4);
  assert.throws(() => filterDailyRecords(records, { date_from: '2024-02-30' }), /không hợp lệ/);
  assert.throws(() => filterDailyRecords(records, { date_from: '2025', date_to: '2024' }), /Ngày bắt đầu/);
});

test('aggregates sort numeric time, preserve provenance and do not exclude extreme rain', () => {
  const records = [row('2024-10-01', 872.9, { quality_status: 'requires_review', quality_issues: ['EXTREME_GE_500MM_REQUIRES_CHECK'] }), row('2024-02-01', 0)];
  const daily = aggregateDaily(records, { date_from: '2024-10-01', date_to: '2024-10-01' });
  assert.equal(daily[0].total_rainfall_mm, 872.9);
  assert.deepEqual(daily[0].sources, ['fixture.csv']);
  assert.deepEqual(daily[0].quality_statuses, ['requires_review']);
  const months = aggregateMonthly(records);
  assert.equal(months[0].month, 2);
  assert.equal(months.at(-1)?.month, 10);
  assert.equal(calculateSummaryStats(records).total_records, 2);
});

const actual: NormalizedDataset = JSON.parse(await readFile(new URL('../public/data/normalized_dataset.json', import.meta.url), 'utf8'));
const service = createDataService(async () => actual);

test('corrupt or omitted indexed quality references fail closed', async () => {
  for (const quality_index of [undefined, -1, 0.5, actual.quality_records.length, 1]) {
    const broken = createDataService(async () => ({ ...actual, manifest: { ...actual.manifest, quality_encoding: 'indexed-v1' },
      daily_records: [{ ...actual.daily_records[0], quality_index }] }));
    await assert.rejects(broken.getDailyData(), /chất lượng/);
  }
});

test('normalized totals match all CSV manifest inputs and no daily source rows are lost', async () => {
  assert.equal(actual.daily_records.length, actual.manifest.source_rows['Dataset_ngay.csv']);
  assert.equal(actual.quality_records.length, actual.manifest.source_rows['Chat_luong.csv']);
  assert.equal(actual.river_records.length, actual.manifest.source_rows['Muc_nuoc_ban_tin.csv']);
  assert.equal(new Set(actual.daily_records.map(r => r.source_row)).size, actual.daily_records.length);
  assert.equal((await service.getSummaryStats()).total_records, actual.daily_records.length);
});

test('service exact day boundaries, station/province mismatch and metric selection', async () => {
  const records = await service.getDailyData({ station_name: 'Phú Bài', date_from: '2020-10-01', date_to: '2020-10-05' });
  assert.equal(records.length, 5);
  assert.ok(records.every(r => r.station_name === 'Phú Bài' && r.datetime >= '2020-10-01' && r.datetime <= '2020-10-05'));
  assert.equal((await service.getDailyData({ station_name: 'Phú Bài', province_code: 1 })).length, 0);
  const rainfall = await service.getTimeSeries({ station_name: 'Phú Bài', date_from: '2020-10-01', date_to: '2020-10-05', resolution: 'day', metric: 'rainfall_mm' });
  const temperature = await service.getTimeSeries({ station_name: 'Phú Bài', date_from: '2020-10-01', date_to: '2020-10-05', resolution: 'day', metric: 'temperature_c' });
  assert.deepEqual(rainfall.map(p => p.value), records.map(r => r.rainfall_mm));
  assert.deepEqual(temperature.map(p => p.value), records.map(r => r.temperature_c));
});

test('Cam Ranh absent rainfall remains null, bulletins remain separate instants', async () => {
  const months = await service.getMonthlyData({ station_name: 'Cam Ranh', date_from: '2016', date_to: '2024' });
  const missing = months.filter(m => m.n_valid_rainfall === 0);
  assert.ok(missing.length > 0);
  assert.ok(missing.every(m => m.total_rainfall_mm === null));
  assert.ok(actual.daily_records.every(r => r.river_level_m === null));
  assert.ok(actual.river_records.every(r => r.datetime.endsWith('+07:00')));
  assert.deepEqual(await service.getTimeSeries({ metric: 'river_level_m' }), []);
  const bulletin = actual.river_records[0];
  const day = bulletin.datetime.slice(0, 10);
  const selected = await service.getRiverRecords({ station_name: bulletin.station_name, date_from: day, date_to: day });
  assert.ok(selected.some(r => r.datetime === bulletin.datetime));
});

test('seven large source readings retained with review status; summary percentage is calculated', async () => {
  const extreme = await service.getExtremeRecords();
  assert.equal(extreme.length, 7);
  assert.ok(extreme.every(r => /Cần kiểm chứng/.test(r.status)));
  const summary = await service.getSummaryStats();
  const c = summary.completeness;
  assert.equal(c.rainfall_completeness_pct, Math.round(c.valid_rainfall_days / c.expected_days * 10000) / 100);
  assert.notEqual(c.rainfall_completeness_pct, c.temperature_completeness_pct);
});

test('one-sided date filters outside the source range return empty results, not errors', async () => {
  for (const filter of [{ date_from: '2030' }, { date_to: '2010' }, { date_from: '2030', station_name: 'Unknown' }]) {
    assert.deepEqual(await service.getDailyData(filter), []);
    assert.deepEqual(await service.getMonthlyData(filter), []);
    assert.deepEqual(await service.getYearlyData(filter), []);
    const summary = await service.getSummaryStats(filter);
    assert.equal(summary.total_records, 0);
    assert.equal(summary.completeness.expected_days, 0);
    assert.equal(summary.completeness.rainfall_completeness_pct, null);
  }
});
