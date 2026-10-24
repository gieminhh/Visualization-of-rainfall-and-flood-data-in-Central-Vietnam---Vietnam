import React, { useId } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { getMetricUnit, getMetricColor, formatMonthYear, getMonthName } from '../../utils';
import type { MonthlyAggregate, YearlyAggregate, MetricKey } from '../../types';

// ─── Custom Tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg px-3 py-2 text-xs"
      style={{ borderColor: '#E2E8F0' }}>
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800">
            {p.value !== null && p.value !== undefined ? `${Number(p.value).toFixed(1)} ${p.unit || ''}` : 'Không có dữ liệu'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Monthly Rainfall Bar Chart ─────────────────────────────────────────────
interface MonthlyBarChartProps {
  data: MonthlyAggregate[];
  year?: number;
  metric?: MetricKey;
  stations?: string[];
}

export function MonthlyBarChart({ data, year = 2020, metric = 'rainfall_mm', stations }: MonthlyBarChartProps) {
  const filtered = data.filter(d => d.year === year);
  const stationList = stations || [...new Set(filtered.map(d => d.station_name))];

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const row: Record<string, number | string | null> = { month: getMonthName(month), monthNum: month };
    stationList.forEach(st => {
      const rec = filtered.find(d => d.station_name === st && d.month === month);
      const val = metric === 'rainfall_mm' ? rec?.total_rainfall_mm
        : metric === 'temperature_c' ? rec?.avg_temperature_c
        : metric === 'humidity_pct' ? rec?.avg_humidity_pct
        : null;
      row[st] = val ?? null;
    });
    return row;
  });

  const colors = ['#2563EB', '#0891B2', '#059669', '#D97706'];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit={getMetricUnit(metric)} width={50} />
        <Tooltip content={<CustomTooltip />} filterNull={false} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {stationList.map((st, i) => (
          <Bar key={st} dataKey={st} name={st} unit={getMetricUnit(metric)} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Yearly Line / Area Chart ────────────────────────────────────────────────
interface YearlyLineChartProps {
  data: YearlyAggregate[];
  metric?: MetricKey;
  stations?: string[];
}

export function YearlyLineChart({ data, metric = 'rainfall_mm', stations }: YearlyLineChartProps) {
  const stationList = stations || [...new Set(data.map(d => d.station_name))];
  const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);

  const chartData = years.map(year => {
    const row: Record<string, number | string | null> = { year: String(year) };
    stationList.forEach(st => {
      const rec = data.find(d => d.station_name === st && d.year === year);
      const val = metric === 'rainfall_mm' ? rec?.total_rainfall_mm
        : metric === 'temperature_c' ? rec?.avg_temperature_c
        : metric === 'humidity_pct' ? rec?.avg_humidity_pct
        : null;
      row[st] = val ?? null;
    });
    return row;
  });

  const colors = ['#2563EB', '#0891B2', '#059669', '#D97706'];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit={getMetricUnit(metric)} width={55} />
        <Tooltip content={<CustomTooltip />} filterNull={false} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {stationList.map((st, i) => (
          <Line
            key={st}
            type="linear"
            dataKey={st}
            name={st}
            unit={getMetricUnit(metric)}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: colors[i % colors.length] }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Daily / monthly / yearly time series, preserving absent observations ───
interface TimeSeriesChartProps {
  data?: MonthlyAggregate[];
  points?: { date: string; label: string; station_name: string; value: number | null }[];
  stationName?: string;
  metric: MetricKey;
  yearFrom?: number;
  yearTo?: number;
}

export function TimeSeriesChart({ data = [], points, stationName, metric, yearFrom = 2016, yearTo = 2025 }: TimeSeriesChartProps) {
  const gradientId = useId();
  const filtered = data
    .filter(d => (!stationName || d.station_name === stationName) && d.year >= yearFrom && d.year <= yearTo)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  const series = points ?? filtered.map(d => {
    const val = metric === 'rainfall_mm' ? d.total_rainfall_mm
      : metric === 'temperature_c' ? d.avg_temperature_c
      : metric === 'humidity_pct' ? d.avg_humidity_pct
      : null;
    return {
      date: `${d.year}-${String(d.month).padStart(2, '0')}-01`,
      label: formatMonthYear(d.year, d.month),
      station_name: d.station_name,
      value: val,
    };
  });
  const stationList = [...new Set(series.map(d => d.station_name))];
  const dates = new Map<string, Record<string, string | number | null>>();
  series.forEach(point => {
    if (!dates.has(point.date)) {
      dates.set(point.date, { date: point.date, label: point.label, ...Object.fromEntries(stationList.map(st => [st, null])) });
    }
    dates.get(point.date)![point.station_name] = point.value;
  });
  const chartData = [...dates.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const color = getMetricColor(metric);
  const colors = [color, '#0891B2', '#059669', '#D97706', '#7C3AED', '#DB2777'];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} minTickGap={40} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit={getMetricUnit(metric)} width={55} />
        <Tooltip content={<CustomTooltip />} filterNull={false} />
        {stationList.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {stationList.map((station, index) => <Area
          key={station}
          type="linear"
          dataKey={station}
          name={station}
          unit={getMetricUnit(metric)}
          stroke={colors[index % colors.length]}
          strokeWidth={2}
          fill={stationList.length === 1 ? `url(#${gradientId})` : 'none'}
          dot={chartData.length === 1 ? { r: 4 } : false}
          connectNulls={false}
          isAnimationActive={chartData.length < 1000}
        />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Heatmap: completeness by year/station ───────────────────────────────────
interface HeatmapProps {
  stations: string[];
  years: number[];
  getValue: (station: string, year: number) => number | null;
  label?: string;
}

export function CompletenessHeatmap({ stations, years, getValue, label = 'Mức độ đầy đủ dữ liệu (%)' }: HeatmapProps) {
  const getColor = (v: number | null) => {
    if (v === null) return '#E2E8F0';
    if (v >= 95) return '#059669';
    if (v >= 85) return '#10B981';
    if (v >= 70) return '#D97706';
    if (v >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="overflow-x-auto">
      <div className="text-xs font-medium mb-3" style={{ color: '#64748B' }}>{label}</div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-xs font-medium text-left pb-2 pr-3" style={{ color: '#94A3B8' }}>Trạm</th>
            {years.map(y => (
              <th key={y} className="text-xs font-medium text-center pb-2 px-1" style={{ color: '#94A3B8' }}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map(station => (
            <tr key={station}>
              <td className="text-xs py-1 pr-3 font-medium whitespace-nowrap" style={{ color: '#475569' }}>{station}</td>
              {years.map(year => {
                const val = getValue(station, year);
                return (
                  <td key={year} className="px-1 py-1">
                    <div
                      className="w-8 h-6 rounded flex items-center justify-center text-xs font-medium text-white mx-auto"
                      style={{ backgroundColor: getColor(val), fontSize: 9 }}
                      title={`${station} ${year}: ${val === null ? 'Không có dữ liệu' : `${val.toFixed(1)}%`}`}
                    >
                      {val !== null ? val.toFixed(0) : '–'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { color: '#059669', label: '≥95%' },
          { color: '#10B981', label: '85–94%' },
          { color: '#D97706', label: '70–84%' },
          { color: '#F59E0B', label: '50–69%' },
          { color: '#EF4444', label: '<50%' },
          { color: '#E2E8F0', label: 'Không có dữ liệu' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Comparison Line Chart (2 series) ────────────────────────────────────────
interface ComparisonChartProps {
  dataA: { date: string; label: string; value: number | null }[];
  dataB: { date: string; label: string; value: number | null }[];
  labelA: string;
  labelB: string;
  metric: MetricKey;
  height?: number;
}

export function ComparisonLineChart({ dataA, dataB, labelA, labelB, metric, height = 240 }: ComparisonChartProps) {
  const byDateA = new Map(dataA.map(point => [point.date, point]));
  const byDateB = new Map(dataB.map(point => [point.date, point]));
  const dates = [...new Set([...byDateA.keys(), ...byDateB.keys()])].sort();
  const chartData = dates.map(date => ({
    date,
    label: byDateA.get(date)?.label ?? byDateB.get(date)?.label,
    seriesA: byDateA.get(date)?.value ?? null,
    seriesB: byDateB.get(date)?.value ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} minTickGap={40} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit={getMetricUnit(metric)} width={50} />
        <Tooltip content={<CustomTooltip />} filterNull={false} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="linear" dataKey="seriesA" name={labelA} unit={getMetricUnit(metric)} stroke="#2563EB" strokeWidth={2} dot={chartData.length === 1 ? { r: 4 } : false} connectNulls={false} />
        <Line type="linear" dataKey="seriesB" name={labelB} unit={getMetricUnit(metric)} stroke="#0891B2" strokeWidth={2} dot={chartData.length === 1 ? { r: 4 } : false} strokeDasharray="5 3" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Forecast Chart (with uncertainty band) ──────────────────────────────────
interface ForecastChartProps {
  historical: { label: string; value: number }[];
  forecast: { label: string; predicted: number; lower: number; upper: number }[];
  metric: MetricKey;
}

export function ForecastChart({ historical, forecast, metric }: ForecastChartProps) {
  const histData = historical.map(d => ({ ...d, type: 'Lịch sử' }));
  const forecastData = forecast.map(d => ({ label: d.label, predicted: d.predicted, lower: d.lower, upper: d.upper, type: 'Dự báo' }));
  const allLabels = [...historical.map(d => d.label), ...forecast.map(d => d.label)];

  const chartData = allLabels.map(lbl => {
    const h = historical.find(d => d.label === lbl);
    const f = forecast.find(d => d.label === lbl);
    return {
      label: lbl,
      'Lịch sử mô phỏng': h?.value ?? null,
      'Dự báo mô phỏng': f?.predicted ?? null,
      lower: f?.lower ?? null,
      upper: f?.upper ?? null,
    };
  });

  const lastHistLabel = historical[historical.length - 1]?.label;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0891B2" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#0891B2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={3} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit={getMetricUnit(metric)} width={55} />
        <Tooltip content={<CustomTooltip />} filterNull={false} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {lastHistLabel && <ReferenceLine x={lastHistLabel} stroke="#D97706" strokeDasharray="4 2" label={{ value: 'Điểm dự báo', fontSize: 10, fill: '#D97706' }} />}
        <Area type="monotone" dataKey="upper" name="Giới hạn trên" stroke="none" fill="#E0F2FE" fillOpacity={0.6} legendType="none" />
        <Area type="monotone" dataKey="lower" name="Giới hạn dưới" stroke="none" fill="#FFFFFF" fillOpacity={1} legendType="none" />
        <Line type="monotone" dataKey="Lịch sử mô phỏng" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls={false} />
        <Line type="monotone" dataKey="Dự báo mô phỏng" stroke="#0891B2" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#0891B2' }} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}
