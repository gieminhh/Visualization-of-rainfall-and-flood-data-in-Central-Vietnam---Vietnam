// Static research prompts only. All observations come from dataService and normalized CSV.
export const RESEARCH_QUESTIONS = [
  {
    id: 'rq1',
    title: 'Biến động lượng mưa theo năm',
    description: 'Lượng mưa miền Trung biến động như thế nào qua các năm 2016–2025?',
    defaultFilter: { station_name: null, province_code: null, metric: 'rainfall_mm' as const, resolution: 'year' as const },
    icon: 'TrendingUp',
  },
  {
    id: 'rq2',
    title: 'Khác biệt mùa mưa Huế – Nghệ An',
    description: 'Sự khác biệt lượng mưa giữa trạm Phú Bài (Huế) và Vinh (Nghệ An)?',
    defaultFilter: { station_name: 'Phú Bài', province_code: 6, metric: 'rainfall_mm' as const, resolution: 'month' as const },
    icon: 'GitCompare',
  },
  {
    id: 'rq3',
    title: 'Các sự kiện mưa cực đoan (≥ 500mm/ngày)',
    description: 'Khám phá các số mưa cực lớn từ nguồn, có trạng thái cần kiểm chứng',
    defaultFilter: { station_name: 'Đồng Hới', province_code: 4, metric: 'rainfall_mm' as const, resolution: 'month' as const },
    icon: 'AlertTriangle',
  },
  {
    id: 'rq4',
    title: 'Tương quan nhiệt độ & độ ẩm',
    description: 'Nhiệt độ, độ ẩm và lượng mưa biến thiên theo mùa như thế nào?',
    defaultFilter: { station_name: 'Đà Nẵng', province_code: 7, metric: 'temperature_c' as const, resolution: 'month' as const },
    icon: 'ScatterChart',
  },
];
