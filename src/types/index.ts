// === TYPES: Core data types matching CSV structure ===
// Các kiểu dữ liệu ánh xạ với cấu trúc CSV thực tế

export interface DailyRecord {
  datetime: string;           // YYYY-MM-DD: UTC day label, not an observation instant
  longitude: number | null;
  latitude: number | null;
  province_code: number;
  station_name: string;
  rainfall_mm: number | null;
  river_level_m: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  source_file?: string;
  source_row?: number;
  source_station_id?: string;
  source_url?: string;
  raw_values?: Record<string, string>;
  quality?: QualityRecord | null;
  quality_index?: number | null;
  quality_status?: 'source_reported' | 'requires_review' | 'invalid' | 'unmatched';
  quality_issues?: string[];
}

export interface Station {
  station_name: string;
  source_station_id: string;
  legacy_isd_id: string;
  province_code: number;
  province_name: string;
  longitude: number;
  latitude: number;
  first_date: string;
  last_date: string;
  n_rows: number;
  n_rainfall: number;
  n_temperature: number;
  n_humidity: number;
  climate_source: string;
  latest_source_url: string;
  isd_distance_km: number | null;
}

export interface Province {
  province_code: number;
  province_name: string;
  n_weather_stations: number;
  n_daily_rows: number;
  n_river_records: number;
  coverage_note: string;
}

export interface RiverRecord {
  datetime: string;
  longitude: number | null;
  latitude: number | null;
  province_code: number;
  station_name: string;
  rainfall_mm: number | null;
  river_level_m: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  timezone: string;
  observation_type: string;
  river_name: string;
  source_url: string;
  water_level_datum: string;
  quality_note: string;
  original_datetime?: string;
  source_file?: string;
  source_row?: number;
  raw_values?: Record<string, string>;
  quality_issues?: string[];
}

export interface QualityRecord {
  datetime: string;
  station_name: string;
  source_station_id: string;
  precip_flag: string;         // D=4×6h, F=2×12h, G=1×24h, 24=24 reports; H/I do not prove zero rain
  precip_reported_mm: number | null;
  precip_status: string;       // FULL_24H, PARTIAL, etc.
  temperature_n_obs: number | null;
  humidity_n_hours: number | null;
  humidity_method: string;
  humidity_status: string;
  isd_distance_km: number | null;
  source_file?: string;
  source_row?: number;
  raw_values?: Record<string, string>;
  quality_issues?: string[];
}

export interface FieldDescription {
  field_or_topic: string;
  data_type: string;
  unit: string;
  definition_or_value: string;
  notes: string;
}

// === Derived / aggregated types for charts ===

export interface MonthlyAggregate {
  year: number;
  month: number;              // 1–12
  station_name: string;
  province_code: number;
  avg_rainfall_mm: number | null;
  total_rainfall_mm: number | null;
  avg_temperature_c: number | null;
  avg_humidity_pct: number | null;
  n_records: number;
  n_valid_rainfall: number;
  completeness_pct: number;
  period_start: string;
  period_end: string;
  expected_days: number;
  recorded_days: number;
  n_valid_temperature: number;
  n_valid_humidity: number;
  completeness: Completeness;
  warnings: string[];
  sources: string[];
  quality_statuses: string[];
  quality_issues: string[];
}

export interface YearlyAggregate {
  year: number;
  station_name: string;
  province_code: number;
  total_rainfall_mm: number | null;
  avg_temperature_c: number | null;
  avg_humidity_pct: number | null;
  n_records: number;
  completeness_pct: number;
  max_daily_rainfall: number | null;
  period_start: string;
  period_end: string;
  expected_days: number;
  recorded_days: number;
  n_valid_rainfall: number;
  n_valid_temperature: number;
  n_valid_humidity: number;
  completeness: Completeness;
  is_partial_year: boolean;
  is_complete_year: boolean;
  warnings: string[];
  sources: string[];
  quality_statuses: string[];
  quality_issues: string[];
}

export type MetricKey = 'rainfall_mm' | 'temperature_c' | 'humidity_pct' | 'river_level_m';
export type Resolution = 'day' | 'month' | 'year';

export interface FilterState {
  province_code: number | null;
  station_name: string | null;
  date_from: string;
  date_to: string;
  metric: MetricKey;
  resolution: Resolution;
}

// === AI Lab types ===
export type ModelType = 'Ridge' | 'Seasonal';
export type ForecastHorizon = 1 | 2 | 3;

export interface ExperimentConfig {
  station_name: string;
  target_variable: MetricKey;
  train_from: string;
  train_to: string;
  model: ModelType;
  horizon: ForecastHorizon;
  evaluation_method: string;
}

export interface ModelMetrics {
  model: ModelType;
  mae: number;
  rmse: number;
  mape: number | null;
  r2: number | null;
}

export interface ForecastPoint {
  datetime: string;
  actual: number | null;
  predicted: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
}

export interface Experiment {
  id: string;
  created_at: string;
  config: ExperimentConfig;
  metrics: ModelMetrics[];
  forecast: ForecastPoint[];
  is_demo: false;              // Results computed from observed data
  notes: string;
}

// === Research Notebook types ===
export type BlockType =
  | 'research_question'
  | 'dataset_methodology'
  | 'visualization'
  | 'statistical_results'
  | 'research_notes'
  | 'conclusion';

export interface NotebookBlock {
  id: string;
  type: BlockType;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  filter_snapshot?: FilterState;
  chart_config?: Record<string, unknown>;
}

export interface ResearchSession {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  blocks: NotebookBlock[];
  tags: string[];
}

// === Data quality types ===
export interface DatasetStats {
  station_name: string;
  province_code: number;
  year: number;
  total_days: number;
  valid_rainfall: number;
  valid_temperature: number;
  valid_humidity: number;
  missing_rainfall: number;
  missing_temperature: number;
  missing_humidity: number;
  completeness_rainfall_pct: number;
  completeness_temperature_pct: number;
  completeness_humidity_pct: number;
  expected_days: number;
  recorded_days: number;
  completeness_records_pct: number;
}

export interface Completeness {
  expected_days: number; // Station-days when more than one station is selected
  recorded_days: number;
  valid_rainfall_days: number;
  valid_temperature_days: number;
  valid_humidity_days: number;
  valid_river_level_days: number;
  record_completeness_pct: number | null;
  rainfall_completeness_pct: number | null;
  temperature_completeness_pct: number | null;
  humidity_completeness_pct: number | null;
  river_level_completeness_pct: number | null;
}

export interface DataManifest {
  imported_at?: string;
  schema_version: string;
  quality_encoding?: string;
  source_rows: Record<string, number>;
  output_rows: Record<string, number>;
  source_files: { name: string; sha256: string; rows: number }[];
  matched_quality_rows: number;
  unmatched_quality_rows: number;
  unmatched_daily_rows: number;
  warnings: string[];
  date_range: { from: string; to: string };
  daily_time_basis: string;
  river_time_basis: string;
}

export interface NormalizedDataset {
  daily_records: DailyRecord[];
  quality_records: QualityRecord[];
  stations: Station[];
  provinces: Province[];
  river_records: RiverRecord[];
  descriptions: FieldDescription[];
  manifest: DataManifest;
}

export interface SummaryStats {
  total_records: number;
  total_stations: number;
  stations_with_daily_data: number;
  date_from: string;
  date_to: string;
  provinces_covered: number;
  provinces_total: number;
  river_records: number;
  completeness: Completeness;
  data_note: string;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  station_name: string;
  value: number | null;
}

export interface ExtremeRecord {
  datetime: string;
  station_name: string;
  province_code: number;
  precip_reported_mm: number;
  precip_flag: string;
  status: string;
  source_url: string;
}
