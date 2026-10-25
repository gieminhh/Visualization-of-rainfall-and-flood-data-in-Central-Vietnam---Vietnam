import Papa from 'papaparse';

/** Daily timestamps are UTC calendar labels; river timestamps are Vietnam instants. */
export const SOURCE_FILES = [
  'Dataset_ngay.csv', 'Tram_do.csv', 'Tinh_thanh.csv',
  'Muc_nuoc_ban_tin.csv', 'Chat_luong.csv', 'Mo_ta.csv',
] as const;
export type SourceFileName = typeof SOURCE_FILES[number];
type CsvRow = Record<string, string>;
type QualityStatus = 'source_reported' | 'requires_review' | 'invalid' | 'unmatched';

const HEADERS: Record<SourceFileName, readonly string[]> = {
  'Dataset_ngay.csv': ['datetime', 'longitude', 'latitude', 'province_code', 'station_name', 'rainfall_mm', 'river_level_m', 'temperature_c', 'humidity_pct'],
  'Tram_do.csv': ['station_name', 'source_station_id', 'legacy_isd_id', 'province_code', 'province_name', 'longitude', 'latitude', 'first_date', 'last_date', 'n_rows', 'n_rainfall', 'n_temperature', 'n_humidity', 'climate_source', 'latest_source_url', 'isd_distance_km'],
  'Tinh_thanh.csv': ['province_code', 'province_name', 'n_weather_stations', 'n_daily_rows', 'n_river_records', 'coverage_note'],
  'Muc_nuoc_ban_tin.csv': ['datetime', 'longitude', 'latitude', 'province_code', 'station_name', 'rainfall_mm', 'river_level_m', 'temperature_c', 'humidity_pct', 'timezone', 'observation_type', 'river_name', 'source_url', 'water_level_datum', 'quality_note'],
  'Chat_luong.csv': ['datetime', 'station_name', 'source_station_id', 'precip_flag', 'precip_reported_mm', 'precip_status', 'temperature_n_obs', 'humidity_n_hours', 'humidity_method', 'humidity_status', 'isd_distance_km'],
  'Mo_ta.csv': ['field_or_topic', 'data_type', 'unit', 'definition_or_value', 'notes'],
};

export function parseCsv(filename: SourceFileName, contents: string): CsvRow[] {
  const parsed = Papa.parse<CsvRow>(contents.replace(/^\uFEFF/, ''), {
    header: true,
    delimiter: ',',
    skipEmptyLines: 'greedy',
    transformHeader: (header: string) => header.trim(),
  });
  if (parsed.errors.length) {
    throw new Error(`${filename}: CSV không hợp lệ: ${parsed.errors.map(e => `${e.message} (dòng ${(e.row ?? 0) + 2})`).join('; ')}`);
  }
  const missing = HEADERS[filename].filter(header => !parsed.meta.fields?.includes(header));
  if (missing.length) throw new Error(`${filename}: thiếu cột ${missing.join(', ')}`);
  if (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) {
    throw new Error(`${filename}: tên cột trùng lặp`);
  }
  if (!parsed.data.length) throw new Error(`${filename}: không có bản ghi`);
  return parsed.data;
}

function calendarParts(value: string, context: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.0+)?)?$/.exec(value.trim());
  if (!match) throw new Error(`${context}: ngày giờ không hợp lệ ${JSON.stringify(value)}`);
  const [year, month, day, hour, minute, second] = match.slice(1).map(v => Number(v ?? '0'));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 1900 || year > 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new Error(`${context}: ngày giờ ngoài phạm vi ${JSON.stringify(value)}`);
  }
  return { label: `${match[1]}-${match[2]}-${match[3]}`, hour, minute, second };
}

export function normalizeDateLabel(value: string, context = 'datetime'): string {
  const date = calendarParts(value, context);
  if (date.hour || date.minute || date.second) throw new Error(`${context}: nhãn ngày UTC phải có giờ 00:00:00`);
  return date.label;
}

export function normalizeRiverDatetime(value: string, timezone: string, context = 'datetime'): string {
  if (timezone.trim() !== 'Asia/Ho_Chi_Minh') throw new Error(`${context}: múi giờ bản tin chưa hỗ trợ ${JSON.stringify(timezone)}`);
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value.trim())) {
    throw new Error(`${context}: bản tin phải có giờ quan trắc gốc; không suy ra 00:00 từ ngày thiếu giờ`);
  }
  const date = calendarParts(value, context);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.label}T${pad(date.hour)}:${pad(date.minute)}:${pad(date.second)}+07:00`;
}

function required(row: CsvRow, field: string, context: string): string {
  const value = row[field]?.trim();
  if (!value) throw new Error(`${context}: thiếu ${field}`);
  return value;
}

function strictNumber(row: CsvRow, field: string, context: string, min = -Infinity, max = Infinity, integer = false): number {
  const raw = required(row, field, context);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${context}: ${field} ngoài phạm vi: ${JSON.stringify(raw)}`);
  }
  return value;
}

function optionalNumber(row: CsvRow, field: string, context: string, min = -Infinity, max = Infinity): number | null {
  return row[field].trim() === '' ? null : strictNumber(row, field, context, min, max);
}

function metricNumber(row: CsvRow, field: string, issues: string[], rawValues: CsvRow, min = -Infinity, max = Infinity): number | null {
  const raw = row[field].trim();
  if (raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    issues.push(`INVALID_${field.toUpperCase()}`);
    rawValues[field] = row[field];
    return null;
  }
  return value;
}

function unique<T>(items: T[], getKey: (item: T) => string, filename: SourceFileName) {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = getKey(item);
    if (map.has(key)) throw new Error(`${filename}: khóa trùng lặp ${key}. Không tự loại bản ghi.`);
    map.set(key, item);
  }
  return map;
}

function sourceUrl(template: string, year: string): string {
  // The supplied station URL is a template for its latest year (Mo_ta.csv).
  return template.replace(/\/(?:19|20)\d{2}\//g, `/${year}/`).replace(/_(?:19|20)\d{2}\.csv$/, `_${year}.csv`);
}

/** Pure, deterministic normalization. All source rows survive or the entire run fails. */
export function normalizeDatasetCore(sources: Partial<Record<SourceFileName, string>>, hashes: Record<string, string>) {
  const missing = SOURCE_FILES.filter(file => sources[file] === undefined);
  if (missing.length) throw new Error(`Thiếu CSV bắt buộc trong data/raw/: ${missing.join(', ')}`);
  const tables = Object.fromEntries(SOURCE_FILES.map(file => [file, parseCsv(file, sources[file]!)])) as Record<SourceFileName, CsvRow[]>;
  const warnings: string[] = [];
  const provinces = tables['Tinh_thanh.csv'].map((row, i) => {
    const context = `Tinh_thanh.csv:${i + 2}`;
    return {
      province_code: strictNumber(row, 'province_code', context, 1, Infinity, true),
      province_name: required(row, 'province_name', context),
      n_weather_stations: strictNumber(row, 'n_weather_stations', context, 0, Infinity, true),
      n_daily_rows: strictNumber(row, 'n_daily_rows', context, 0, Infinity, true),
      n_river_records: strictNumber(row, 'n_river_records', context, 0, Infinity, true),
      coverage_note: row.coverage_note,
    };
  });
  const provinceByCode = unique(provinces, row => String(row.province_code), 'Tinh_thanh.csv');
  const validateProvince = (code: number, context: string) => {
    if (!provinceByCode.has(String(code))) throw new Error(`${context}: mã tỉnh ${code} không có trong Tinh_thanh.csv`);
    return code;
  };
  const stations = tables['Tram_do.csv'].map((row, i) => {
    const context = `Tram_do.csv:${i + 2}`;
    const station = {
      station_name: required(row, 'station_name', context),
      source_station_id: required(row, 'source_station_id', context),
      legacy_isd_id: row.legacy_isd_id,
      province_code: validateProvince(strictNumber(row, 'province_code', context, 1, Infinity, true), context),
      province_name: required(row, 'province_name', context),
      longitude: strictNumber(row, 'longitude', context, -180, 180),
      latitude: strictNumber(row, 'latitude', context, -90, 90),
      first_date: normalizeDateLabel(row.first_date, context),
      last_date: normalizeDateLabel(row.last_date, context),
      n_rows: strictNumber(row, 'n_rows', context, 0, Infinity, true),
      n_rainfall: strictNumber(row, 'n_rainfall', context, 0, Infinity, true),
      n_temperature: strictNumber(row, 'n_temperature', context, 0, Infinity, true),
      n_humidity: strictNumber(row, 'n_humidity', context, 0, Infinity, true),
      climate_source: required(row, 'climate_source', context),
      latest_source_url: required(row, 'latest_source_url', context),
      isd_distance_km: optionalNumber(row, 'isd_distance_km', context, 0),
    };
    if (station.first_date > station.last_date) throw new Error(`${context}: first_date sau last_date`);
    return station;
  });
  const stationByName = unique(stations, row => row.station_name, 'Tram_do.csv');
  unique(stations, row => row.source_station_id, 'Tram_do.csv');

  const quality_records = tables['Chat_luong.csv'].map((row, i) => {
    const context = `Chat_luong.csv:${i + 2}`;
    const issues: string[] = [];
    const raw_values: CsvRow = { datetime: row.datetime };
    const numeric = (field: string, min = 0, max = Infinity) => metricNumber(row, field, issues, raw_values, min, max);
    const result = {
      datetime: normalizeDateLabel(row.datetime, context),
      station_name: required(row, 'station_name', context),
      source_station_id: required(row, 'source_station_id', context),
      precip_flag: row.precip_flag.trim(),
      precip_reported_mm: numeric('precip_reported_mm'),
      precip_status: required(row, 'precip_status', context),
      temperature_n_obs: numeric('temperature_n_obs', 0, 24),
      humidity_n_hours: numeric('humidity_n_hours', 0, 24),
      humidity_method: row.humidity_method,
      humidity_status: row.humidity_status.trim(),
      isd_distance_km: numeric('isd_distance_km'),
      source_file: 'Chat_luong.csv',
      source_row: i + 2,
      raw_values,
      quality_issues: issues,
    };
    for (const field of ['temperature_n_obs', 'humidity_n_hours'] as const) {
      const value = result[field];
      if (value !== null && !Number.isInteger(value)) {
        issues.push(`INVALID_${field.toUpperCase()}`);
        raw_values[field] = row[field];
        result[field] = null;
      }
    }
    if (stationByName.get(result.station_name)?.source_station_id !== result.source_station_id) issues.push('SOURCE_STATION_ID_MISMATCH');
    return result;
  });
  const key = (row: { station_name: string; datetime: string }) => `${row.station_name}|${row.datetime}`;
  const qualityByKey = unique(quality_records, key, 'Chat_luong.csv');
  const matchedQuality = new Set<string>();
  const fullDayFlags = new Set(['D', 'F', 'G', '24']);

  const daily_records = tables['Dataset_ngay.csv'].map((row, i) => {
    const context = `Dataset_ngay.csv:${i + 2}`;
    const datetime = normalizeDateLabel(row.datetime, context);
    const station_name = required(row, 'station_name', context);
    const station = stationByName.get(station_name);
    if (!station) throw new Error(`${context}: trạm ${station_name} không có trong Tram_do.csv`);
    const province_code = validateProvince(strictNumber(row, 'province_code', context, 1, Infinity, true), context);
    if (province_code !== station.province_code) throw new Error(`${context}: mã tỉnh không khớp danh mục trạm`);
    const candidate = qualityByKey.get(key({ station_name, datetime }));
    const quality = candidate?.source_station_id === station.source_station_id ? candidate : null;
    if (quality) matchedQuality.add(key(quality));
    const quality_issues: string[] = quality ? [...quality.quality_issues] : ['QUALITY_RECORD_UNMATCHED'];
    const raw_values: CsvRow = { datetime: row.datetime };
    let rainfall_mm = metricNumber(row, 'rainfall_mm', quality_issues, raw_values, 0);
    const temperature_c = metricNumber(row, 'temperature_c', quality_issues, raw_values, -100, 70);
    let humidity_pct = metricNumber(row, 'humidity_pct', quality_issues, raw_values, 0, 100);
    const river_level_m = metricNumber(row, 'river_level_m', quality_issues, raw_values);
    const longitude = optionalNumber(row, 'longitude', context, -180, 180);
    const latitude = optionalNumber(row, 'latitude', context, -90, 90);
    if ((longitude !== null && Math.abs(longitude - station.longitude) > 0.0001) || (latitude !== null && Math.abs(latitude - station.latitude) > 0.0001)) quality_issues.push('COORDINATES_DIFFER_FROM_STATION_METADATA');
    if (rainfall_mm !== null) {
      const fullDay = quality && fullDayFlags.has(quality.precip_flag) && (quality.precip_status === 'FULL_24H' || quality.precip_status === 'EXTREME_GE_500MM_REQUIRES_CHECK');
      if (!fullDay) {
        raw_values.rainfall_mm = row.rainfall_mm;
        rainfall_mm = null;
        quality_issues.push('RAINFALL_PERIOD_NOT_CONFIRMED_24H');
      } else {
        if (quality.precip_reported_mm !== null && Math.abs(rainfall_mm - quality.precip_reported_mm) > 0.001) quality_issues.push('RAINFALL_DIFFERS_FROM_QUALITY_SOURCE');
        if (rainfall_mm >= 500 || quality.precip_status === 'EXTREME_GE_500MM_REQUIRES_CHECK') quality_issues.push('EXTREME_GE_500MM_REQUIRES_CHECK');
      }
    }
    if (humidity_pct !== null && (!quality || quality.humidity_status !== 'OK_MIN4' || quality.humidity_n_hours === null || quality.humidity_n_hours < 4)) {
      raw_values.humidity_pct = row.humidity_pct;
      humidity_pct = null;
      quality_issues.push('HUMIDITY_MIN4_HOURS_NOT_CONFIRMED');
    }
    if (river_level_m !== null) quality_issues.push('UNEXPECTED_DAILY_RIVER_LEVEL_REQUIRES_CHECK');
    let quality_status: QualityStatus = 'source_reported';
    if (!quality) quality_status = 'unmatched';
    else if (quality_issues.some(issue => issue.startsWith('INVALID_'))) quality_status = 'invalid';
    else if (quality_issues.length) quality_status = 'requires_review';
    return {
      datetime, longitude, latitude, province_code, station_name,
      rainfall_mm, river_level_m, temperature_c, humidity_pct,
      source_file: 'Dataset_ngay.csv', source_row: i + 2,
      source_station_id: station.source_station_id,
      source_url: sourceUrl(station.latest_source_url, datetime.slice(0, 4)),
      quality, quality_status, quality_issues, raw_values,
    };
  });
  unique(daily_records, key, 'Dataset_ngay.csv');

  const river_records = tables['Muc_nuoc_ban_tin.csv'].map((row, i) => {
    const context = `Muc_nuoc_ban_tin.csv:${i + 2}`;
    const quality_issues: string[] = [];
    const raw_values: CsvRow = { datetime: row.datetime };
    const river = {
      datetime: normalizeRiverDatetime(row.datetime, row.timezone, context),
      original_datetime: row.datetime,
      longitude: optionalNumber(row, 'longitude', context, -180, 180),
      latitude: optionalNumber(row, 'latitude', context, -90, 90),
      province_code: validateProvince(strictNumber(row, 'province_code', context, 1, Infinity, true), context),
      station_name: required(row, 'station_name', context),
      rainfall_mm: metricNumber(row, 'rainfall_mm', quality_issues, raw_values, 0),
      river_level_m: metricNumber(row, 'river_level_m', quality_issues, raw_values),
      temperature_c: metricNumber(row, 'temperature_c', quality_issues, raw_values, -100, 70),
      humidity_pct: metricNumber(row, 'humidity_pct', quality_issues, raw_values, 0, 100),
      timezone: row.timezone,
      observation_type: required(row, 'observation_type', context),
      river_name: row.river_name,
      source_url: required(row, 'source_url', context),
      water_level_datum: row.water_level_datum,
      quality_note: row.quality_note,
      source_file: 'Muc_nuoc_ban_tin.csv', source_row: i + 2,
      quality_issues, raw_values,
    };
    return river;
  });
  unique(river_records, key, 'Muc_nuoc_ban_tin.csv');
  const descriptions = tables['Mo_ta.csv'].map(row => ({
    field_or_topic: row.field_or_topic, data_type: row.data_type, unit: row.unit,
    definition_or_value: row.definition_or_value, notes: row.notes,
  }));

  const unmatchedDaily = daily_records.filter(row => row.quality === null).length;
  const unmatchedQuality = quality_records.length - matchedQuality.size;
  if (unmatchedDaily) warnings.push(`${unmatchedDaily} bản ghi khí tượng không ghép được chất lượng theo trạm, ngày UTC và mã nguồn.`);
  if (unmatchedQuality) warnings.push(`${unmatchedQuality} bản ghi chất lượng không ghép được khí tượng.`);
  const reviewRows = daily_records.filter(row => row.quality_status === 'requires_review').length;
  const invalidRows = daily_records.filter(row => row.quality_status === 'invalid').length;
  if (reviewRows) warnings.push(`${reviewRows} bản ghi khí tượng cần kiểm chứng; giữ số mưa cực lớn đủ kỳ theo nguồn, chưa xác thực.`);
  if (invalidRows) warnings.push(`${invalidRows} bản ghi có giá trị ngoài phạm vi; giá trị bị loại lưu tại raw_values.`);
  const invalidQualityRows = quality_records.filter(row => row.quality_issues.length).length;
  if (invalidQualityRows) warnings.push(`${invalidQualityRows} bản ghi chất lượng có vấn đề, xem quality_issues.`);
  const invalidRiverRows = river_records.filter(row => row.quality_issues.length).length;
  if (invalidRiverRows) warnings.push(`${invalidRiverRows} bản ghi mực nước có giá trị ngoài phạm vi, xem quality_issues.`);
  for (const station of stations) {
    const records = daily_records.filter(row => row.station_name === station.station_name);
    const counts = { n_rows: records.length, n_rainfall: records.filter(row => row.rainfall_mm !== null).length, n_temperature: records.filter(row => row.temperature_c !== null).length, n_humidity: records.filter(row => row.humidity_pct !== null).length };
    for (const field of ['n_rows', 'n_rainfall', 'n_temperature', 'n_humidity'] as const) {
      if (station[field] !== counts[field]) warnings.push(`Tram_do.csv: ${station.station_name} ${field}=${station[field]}, dữ liệu chuẩn hóa=${counts[field]}.`);
    }
  }
  for (const province of provinces) {
    const counts = { n_weather_stations: stations.filter(row => row.province_code === province.province_code).length, n_daily_rows: daily_records.filter(row => row.province_code === province.province_code).length, n_river_records: river_records.filter(row => row.province_code === province.province_code).length };
    for (const field of ['n_weather_stations', 'n_daily_rows', 'n_river_records'] as const) {
      if (province[field] !== counts[field]) warnings.push(`Tinh_thanh.csv: ${province.province_name} ${field}=${province[field]}, dữ liệu chuẩn hóa=${counts[field]}.`);
    }
  }
  const dates = daily_records.map(row => row.datetime).sort();
  const source_rows = Object.fromEntries(SOURCE_FILES.map(name => [name, tables[name].length]));
  const output_rows = { daily_records: daily_records.length, quality_records: quality_records.length, stations: stations.length, provinces: provinces.length, river_records: river_records.length, descriptions: descriptions.length };
  return {
    daily_records, quality_records, stations, provinces, river_records, descriptions,
    manifest: {
      schema_version: '1.0.0',
      source_rows,
      output_rows,
      matched_quality_rows: matchedQuality.size,
      unmatched_quality_rows: unmatchedQuality,
      unmatched_daily_rows: unmatchedDaily,
      warnings,
      source_files: SOURCE_FILES.map(name => ({ name, sha256: hashes[name], rows: tables[name].length })),
      date_range: { from: dates[0], to: dates[dates.length - 1] },
      daily_time_basis: 'UTC_DATE_LABEL',
      river_time_basis: 'Asia/Ho_Chi_Minh',
    },
  };
}

/** Compact transport shares the quality table; indices reference exact matched objects. */
export function createTransportDataset(dataset: ReturnType<typeof normalizeDatasetCore>) {
  const qualityIndices = new Map(dataset.quality_records.map((record, index) => [record, index]));
  const daily_records = dataset.daily_records.map(record => {
    const { quality, ...daily } = record;
    const quality_index = quality === null ? null : qualityIndices.get(quality);
    if (quality_index === undefined) throw new Error(`Không thể mã hóa chất lượng của ${record.station_name} ${record.datetime}: bản ghi không nằm trong bảng chất lượng.`);
    return { ...daily, quality_index };
  });
  return {
    ...dataset,
    daily_records,
    manifest: { ...dataset.manifest, schema_version: '1.1.0', quality_encoding: 'indexed-v1' },
  };
}
