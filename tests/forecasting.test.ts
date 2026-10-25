import test from 'node:test';
import assert from 'node:assert/strict';
import { fitModel, prepareMonths, runForecast, score } from '../src/services/forecasting.ts';
import type { MonthSample } from '../src/services/forecasting.ts';
import { aggregateMonthly } from '../src/services/dataProcessing.ts';
import type { DailyRecord } from '../src/types/index.ts';

const samples: MonthSample[] = Array.from({ length: 84 }, (_, i) => ({
  index: 2016 * 12 + i, date: `${2016 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`,
  value: 100 + 70 * Math.sin(2 * Math.PI * i / 12),
}));

test('real seasonal baseline recovers a repeated cycle with zero error', () => {
  const result = runForecast(samples, 'Seasonal', 3);
  assert.ok(result.metrics.mae < 1e-10);
  assert.equal(result.metrics.n, 36);
  assert.equal(result.forecast[0].date, '2023-01');
  assert.equal(result.forecast[2].date, '2023-03');
  assert.ok(Math.abs(result.forecast[0].predicted - 100) < 1e-10);
});

test('Ridge learns from training values deterministically', () => {
  const first = runForecast(samples, 'Ridge', 2);
  assert.deepEqual(first, runForecast(samples, 'Ridge', 2));
  assert.ok(first.metrics.mae < 3);
  const doubled = runForecast(samples.map(row => ({ ...row, value: row.value! * 2 })), 'Ridge', 2);
  assert.ok(Math.abs(doubled.forecast[0].predicted - 2 * first.forecast[0].predicted) < 1e-8);
});

test('rolling forecasts cannot see future target values', () => {
  const before = runForecast(samples, 'Ridge', 3);
  const changed = samples.map((row, i) => ({ ...row, value: i === 83 ? 99999 : row.value }));
  const after = runForecast(changed, 'Ridge', 3);
  assert.deepEqual(before.backtest.map(row => row.predicted), after.backtest.map(row => row.predicted));
  assert.notEqual(before.metrics.mae, after.metrics.mae);
});

test('missing data stays missing and insufficient histories fail', () => {
  const missing = samples.map((row, i) => ({ ...row, value: i % 5 === 0 ? null : row.value }));
  const result = runForecast(missing, 'Seasonal', 1);
  assert.ok(result.excludedMonths > 0);
  assert.ok(result.historical.some(row => row.value === null));
  assert.ok(result.backtest.every(row => missing.find(sample => sample.date === row.date)?.value != null));
  assert.throws(() => runForecast(samples.slice(0, 20), 'Ridge', 1), /36 tháng/);
  assert.throws(() => fitModel(samples.filter(row => row.index % 12 !== 0), 'Seasonal'), /12 tháng/);
});

test('metrics handle zero rain and constant targets without fake scores', () => {
  const result = score([{ origin: '2020-01', date: '2020-02', lead: 1, actual: 0, predicted: 5 }]);
  assert.equal(result.mae, 5);
  assert.equal(result.rmse, 5);
  assert.equal(result.mape, null);
  assert.equal(result.r2, null);
  assert.equal(result.mape_n, 0);
});

test('a partial source calendar month is not considered a full rainfall month', () => {
  const records = Array.from({ length: 10 }, (_, i) => ({ datetime: `2020-01-${String(i + 1).padStart(2, '0')}`, station_name: 'Test', province_code: 1, rainfall_mm: 0, temperature_c: null, humidity_pct: null, river_level_m: null })) as DailyRecord[];
  const rows = aggregateMonthly(records, { date_from: '2020-01-01', date_to: '2020-01-10', station_names: ['Test'] });
  assert.equal(rows[0].n_valid_rainfall, 10);
  assert.equal(prepareMonths(rows)[0].value, null);
});
