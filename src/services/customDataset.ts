import Papa from 'papaparse';
import type { MonthlyAggregate, Station } from '../types/index.ts';

export interface CustomStationData {
  station: Station;
  monthlyRows: MonthlyAggregate[];
}

export function parseCustomStationCsv(csvText: string, customStationName: string): CustomStationData {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`Lỗi đọc file CSV: ${result.errors[0]?.message || 'Không thể parse'}`);
  }

  const rows = result.data as Record<string, string>[];
  if (rows.length === 0) {
    throw new Error('File CSV không có dữ liệu.');
  }

  // Chuẩn hóa tên cột
  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());

  // Tìm các cột: date/datetime/thoi_gian, rainfall/rain/luong_mua, station/tram
  const dateKey = Object.keys(firstRow).find(k => {
    const l = k.trim().toLowerCase();
    return l.includes('date') || l.includes('time') || l.includes('ngay');
  });

  const rainKey = Object.keys(firstRow).find(k => {
    const l = k.trim().toLowerCase();
    return l.includes('rain') || l.includes('mua') || l.includes('precip');
  });

  if (!dateKey || !rainKey) {
    throw new Error(
      `File CSV cần có tối thiểu cột ngày (chứa 'date', 'datetime' hoặc 'ngay') và cột lượng mưa (chứa 'rainfall', 'rain', 'precip' hoặc 'mua'). Cột hiện có: ${Object.keys(firstRow).join(', ')}`
    );
  }

  const stationKey = Object.keys(firstRow).find(k => {
    const l = k.trim().toLowerCase();
    return l.includes('station') || l.includes('tram');
  });

  const tempKey = Object.keys(firstRow).find(k => {
    const l = k.trim().toLowerCase();
    return l.includes('temp') || l.includes('nhiet');
  });

  const humidKey = Object.keys(firstRow).find(k => {
    const l = k.trim().toLowerCase();
    return l.includes('humid') || l.includes('am');
  });

  const finalStationName = customStationName.trim() || 
    (stationKey && rows[0][stationKey] ? rows[0][stationKey].trim() : 'Trạm Tùy Chọn');

  // Nhóm theo Năm - Tháng để tạo MonthlyAggregate
  const monthlyMap = new Map<string, {
    year: number;
    month: number;
    totalRain: number;
    validDays: number;
    tempSum: number;
    tempCount: number;
    humidSum: number;
    humidCount: number;
  }>();

  let validRainfallCount = 0;
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';

  for (const row of rows) {
    const rawDate = row[dateKey]?.trim();
    if (!rawDate) continue;

    // Chuẩn hóa date: YYYY-MM-DD
    const dateStr = rawDate.slice(0, 10);
    if (dateStr.length < 7) continue;

    if (dateStr < minDate) minDate = dateStr;
    if (dateStr > maxDate) maxDate = dateStr;

    const parts = dateStr.split(/[-/]/);
    let year = 0;
    let month = 0;
    if (parts.length >= 2) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      } else if (parts[2]?.length === 4) {
        year = parseInt(parts[2], 10);
        month = parseInt(parts[1], 10);
      }
    }

    if (!year || !month || month < 1 || month > 12) continue;

    const mKey = `${year}-${String(month).padStart(2, '0')}`;
    let item = monthlyMap.get(mKey);
    if (!item) {
      item = { year, month, totalRain: 0, validDays: 0, tempSum: 0, tempCount: 0, humidSum: 0, humidCount: 0 };
      monthlyMap.set(mKey, item);
    }

    const rawRain = row[rainKey];
    if (rawRain !== undefined && rawRain !== '' && rawRain !== null) {
      const rainVal = parseFloat(rawRain);
      if (!isNaN(rainVal) && rainVal >= 0) {
        item.totalRain += rainVal;
        item.validDays += 1;
        validRainfallCount += 1;
      }
    }

    if (tempKey && row[tempKey]) {
      const tVal = parseFloat(row[tempKey]);
      if (!isNaN(tVal)) {
        item.tempSum += tVal;
        item.tempCount += 1;
      }
    }

    if (humidKey && row[humidKey]) {
      const hVal = parseFloat(row[humidKey]);
      if (!isNaN(hVal)) {
        item.humidSum += hVal;
        item.humidCount += 1;
      }
    }
  }

  if (monthlyMap.size === 0) {
    throw new Error('Không phân tích được dòng dữ liệu ngày/tháng hợp lệ nào từ file CSV.');
  }

  const monthlyRows: MonthlyAggregate[] = Array.from(monthlyMap.values()).map(m => {
    const daysInMonth = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
    const hasFullRain = m.validDays >= 25 || m.validDays === daysInMonth;
    const monthStr = String(m.month).padStart(2, '0');
    const daysStr = String(daysInMonth).padStart(2, '0');

    return {
      year: m.year,
      month: m.month,
      station_name: finalStationName,
      province_code: 99,
      total_rainfall_mm: hasFullRain ? Math.round(m.totalRain * 10) / 10 : null,
      avg_rainfall_mm: m.validDays > 0 ? Math.round((m.totalRain / m.validDays) * 10) / 10 : null,
      avg_temperature_c: m.tempCount > 0 ? Math.round((m.tempSum / m.tempCount) * 10) / 10 : null,
      avg_humidity_pct: m.humidCount > 0 ? Math.round((m.humidSum / m.humidCount) * 10) / 10 : null,
      n_records: m.validDays,
      expected_days: daysInMonth,
      recorded_days: m.validDays,
      n_valid_rainfall: m.validDays,
      n_valid_temperature: m.tempCount,
      n_valid_humidity: m.humidCount,
      completeness_pct: Math.min(100, Math.round((m.validDays / daysInMonth) * 100)),
      period_start: `${m.year}-${monthStr}-01`,
      period_end: `${m.year}-${monthStr}-${daysStr}`,
      warnings: [],
      sources: ['CSV Upload'],
      quality_statuses: ['raw_upload'],
      quality_issues: [],
      completeness: {
        rainfall_mm: Math.min(100, Math.round((m.validDays / daysInMonth) * 100)),
        temperature_c: Math.min(100, Math.round((m.tempCount / daysInMonth) * 100)),
        humidity_pct: Math.min(100, Math.round((m.humidCount / daysInMonth) * 100)),
        river_level_m: 0,
      } as any,
    };
  }).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  const customStation: Station = {
    station_name: finalStationName,
    source_station_id: `CUSTOM-${Date.now().toString().slice(-6)}`,
    legacy_isd_id: '',
    province_code: 99,
    province_name: 'Trạm người dùng tải lên',
    longitude: 108.0,
    latitude: 16.0,
    first_date: minDate,
    last_date: maxDate,
    n_rows: rows.length,
    n_rainfall: validRainfallCount,
    n_temperature: 0,
    n_humidity: 0,
    climate_source: 'CSV Upload',
    latest_source_url: '',
    isd_distance_km: null,
  };

  return {
    station: customStation,
    monthlyRows,
  };
}
