// Service tích hợp Gemini API trực tiếp từ frontend
// Hỗ trợ chọn mô hình linh hoạt (Gemini 2.5, 2.0 Flash, 1.5 Flash, 1.5 Pro...) và tự động quét ListModels

const DEFAULT_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const STORAGE_API_KEY = 'cfr_gemini_api_key';
const STORAGE_SELECTED_MODEL = 'cfr_selected_gemini_model';

export function getStoredApiKey(): string {
  try {
    const custom = localStorage.getItem(STORAGE_API_KEY);
    if (custom && custom.trim()) {
      return custom.trim();
    }
    if (DEFAULT_API_KEY) {
      localStorage.setItem(STORAGE_API_KEY, DEFAULT_API_KEY);
      return DEFAULT_API_KEY;
    }
    return '';
  } catch {
    return DEFAULT_API_KEY;
  }
}

export function saveStoredApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } catch (e) {
    console.error('Không thể lưu API Key vào localStorage', e);
  }
}

export function getStoredModel(): string {
  try {
    return localStorage.getItem(STORAGE_SELECTED_MODEL) || 'gemini-2.0-flash';
  } catch {
    return 'gemini-2.0-flash';
  }
}

export function saveStoredModel(model: string): void {
  try {
    localStorage.setItem(STORAGE_SELECTED_MODEL, model);
  } catch (e) {
    console.error('Không thể lưu model vào localStorage', e);
  }
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ContextData {
  station: string;
  model: string;
  horizon: number;
  result?: {
    validMonths?: number;
    metrics?: {
      mae: number | null;
      rmse: number | null;
      mape: number | null;
      r2: number | null;
      n: number;
    };
    forecast?: Array<{
      date: string;
      predicted: number | null;
      lower: number | null;
      upper: number | null;
    }>;
  };
  stationInfo?: {
    province_name: string;
    n_rows: number;
    n_rainfall: number;
    climate_source: string;
  };
}

export interface ModelOption {
  id: string;
  name: string;
  badge?: string;
  description?: string;
}

export const POPULAR_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', badge: 'Mới nhất', description: 'Tốc độ cực nhanh, phản hồi thông minh' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', badge: 'Thử nghiệm', description: 'Bản thử nghiệm tính năng mới của Google' },
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Latest)', badge: 'Khuyên dùng', description: 'Bản cập nhật mới nhất của dòng 1.5 Flash' },
  { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash 002', badge: 'Ổn định', description: 'Bản tinh chỉnh thứ 2 của 1.5 Flash' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Mô hình chuẩn' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Latest)', badge: 'Nâng cao', description: 'Khả năng lập luận và phân tích chuyên sâu' },
  { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro 002', description: 'Bản tinh chỉnh thứ 2 của 1.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'Thế hệ mới', description: 'Thế hệ tiếp theo' },
];

export async function fetchAvailableModelsFromApi(apiKey: string): Promise<ModelOption[]> {
  const keyToUse = apiKey || DEFAULT_API_KEY;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        const supported = data.models
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => {
            const rawId = m.name.replace('models/', '');
            return {
              id: rawId,
              name: m.displayName || rawId,
              description: m.description ? (m.description.slice(0, 75) + '...') : undefined,
              badge: rawId.includes('2.0') || rawId.includes('2.5') ? 'Thế hệ mới' : (rawId.includes('pro') ? 'Pro' : 'Flash'),
            };
          });

        if (supported.length > 0) {
          return supported.sort((a: ModelOption, b: ModelOption) => {
            const score = (id: string) => {
              if (id.includes('2.0-flash')) return 100;
              if (id.includes('1.5-flash-latest')) return 95;
              if (id.includes('1.5-flash-002')) return 90;
              if (id.includes('1.5-flash')) return 85;
              if (id.includes('pro')) return 80;
              return 50;
            };
            return score(b.id) - score(a.id);
          });
        }
      }
    }
  } catch (err) {
    console.warn('Không thể truy vấn danh sách model qua API:', err);
  }
  return POPULAR_MODELS;
}

// Phản hồi dự phòng khi mất kết nối
function generateLocalResponse(question: string, context: ContextData): string {
  const q = question.toLowerCase();
  const st = context.station;
  const metrics = context.result?.metrics;
  const forecast = context.result?.forecast;

  if (q.includes('cam ranh')) {
    return `### Lưu ý quan trọng về trạm Cam Ranh (Khánh Hòa)
Trong bộ dữ liệu quan trắc 10 năm (2016–2026), trạm Cam Ranh ghi nhận **0 ngày có số liệu lượng mưa** (\`n_rainfall = 0\`). Trạm này chỉ đo nhiệt độ và độ ẩm. 

Do đó, không thể áp dụng các mô hình hồi quy dự báo lượng mưa cho trạm này. Hệ thống hiển thị trạng thái thiếu dữ liệu khách quan thay vì tự gán số 0 tránh bóp méo phân tích.`;
  }

  if (q.includes('mae') || q.includes('rmse') || q.includes('đánh giá') || q.includes('chỉ số') || q.includes('sai số') || q.includes('r2') || q.includes('r²')) {
    if (metrics && metrics.mae !== null) {
      return `### Phân tích chỉ số đánh giá mô hình tại trạm ${st}:
- **MAE (Sai số tuyệt đối trung bình):** **${metrics.mae.toFixed(2)} mm**
- **RMSE (Căn bậc hai sai số bình phương):** **${metrics.rmse?.toFixed(2) ?? '—'} mm**
- **Hệ số xác định $R^2$:** **${metrics.r2 !== null ? metrics.r2.toFixed(3) : 'Không xác định'}**
- **MAPE:** **${metrics.mape !== null ? metrics.mape.toFixed(1) + '%' : '—'}** (đánh giá trên **${metrics.n}** mẫu kiểm thử)

**Ý nghĩa khoa học:**
- MAE phản ánh mức độ sai lệch trung bình giữa lượng mưa dự báo và lượng mưa thực đo trong các tháng kiểm thử.
- RMSE phạt nặng các sai số lớn, phản ánh độ nhạy cảm của mô hình với những tháng mưa đột biến/cực đoan.`;
    }
    return `Hiện chưa có kết quả tính toán mô hình cho trạm **${st}**. Bạn hãy nhấn nút **"Huấn luyện & đánh giá"** ở cột bên trái để hệ thống tính toán kết quả thực tế.`;
  }

  if (q.includes('dự báo') || q.includes('tháng tới') || q.includes('tương lai') || q.includes('kết quả') || q.includes('3 tháng')) {
    if (forecast && forecast.length > 0) {
      const forecastDetails = forecast
        .map(f => `- **Tháng ${f.date}:** Dự báo **${f.predicted?.toFixed(1) ?? '—'} mm** *(khoảng sai số thực nghiệm: ${f.lower?.toFixed(0) ?? '—'} – ${f.upper?.toFixed(0) ?? '—'} mm)*`)
        .join('\n');
      return `### Kết quả dự báo lượng mưa tại trạm ${st} (${context.model} - hạn ${context.horizon} tháng):

${forecastDetails}

**Giải thích:**
Dải sai số được tính theo phân vị 90% từ các sai số tuyệt đối trong quá trình kiểm thử thời gian (backtesting). Kết quả phục vụ nghiên cứu thống kê chuỗi thời gian, không dùng thay thế bản tin cảnh báo thời gian thực.`;
    }
    return `Chưa có kết quả chạy dự báo cho trạm **${st}**. Bạn hãy nhấn **"Huấn luyện & đánh giá"** ở cột bên trái để cập nhật chuỗi dự báo.`;
  }

  if (q.includes('mùa mưa') || q.includes('đặc điểm') || q.includes('khí hậu') || q.includes('phân bố')) {
    if (st.includes('Phú Bài') || st.includes('Huế')) {
      return `### Đặc điểm mùa mưa tại trạm Phú Bài (Thừa Thiên Huế)
- **Tâm mưa miền Trung:** Phú Bài là một trong những điểm có lượng mưa năm cao nhất khu vực (thường dao động 2.800 – 4.200 mm/năm).
- **Mùa mưa lệch pha:** Tập trung mạnh từ tháng 9 đến tháng 12, đỉnh điểm thường rơi vào tháng 10 và tháng 11 với nhiều đợt mưa diện rộng do kết hợp không khí lạnh tăng cường và dải hội tụ nhiệt đới.
- **Mưa cực đoan:** Từng ghi nhận ngày mưa lịch sử lên tới **560.5 mm/24h** (09/10/2020) và **544.7 mm/24h** (15/11/2023).`;
    } else if (st.includes('Đà Nẵng')) {
      return `### Đặc điểm mùa mưa tại trạm Đà Nẵng
- Mùa mưa chính diễn ra từ tháng 9 đến tháng 12, cao điểm vào tháng 10 và tháng 11.
- Tổng lượng mưa năm trung bình khoảng 2.000 – 2.500 mm.
- Sự kiện cực đoan tiêu biểu: Ngày 09/12/2018 ghi nhận lượng mưa 24h kỷ lục lên đến **635 mm**, gây ngập úng đô thị trên diện rộng.`;
    } else if (st.includes('Vinh') || st.includes('Nghệ An')) {
      return `### Đặc điểm mùa mưa tại trạm Vinh (Nghệ An)
- Mùa mưa bắt đầu sớm hơn so với Trung Trung Bộ, thường kéo dài từ tháng 8 đến tháng 11, cực đại vào tháng 9 – 10.
- Ngày 16/10/2019 từng ghi nhận lượng mưa ngày đạt **700 mm**.`;
    }
    return `Trạm **${st}** thuộc vùng khí hậu ven biển miền Trung, chịu tác động trực tiếp của gió mùa đông bắc kết hợp địa hình chắn gió dãy Trường Sơn. Mùa mưa tại đây có tính chất phân mùa rõ rệt, chiếm khoảng 70–80% lượng mưa cả năm.`;
  }

  return `Chào bạn! Tôi là **Trợ lý AI Nghiên cứu Mưa lũ miền Trung**.\n\nBạn đang nghiên cứu trạm: **${st}** (${context.stationInfo?.province_name ?? 'Miền Trung'}), mô hình **${context.model}**, hạn dự báo **${context.horizon} tháng**.\n\n**Gợi ý câu hỏi:**\n1. *"Giải thích ý nghĩa chỉ số MAE, RMSE và R² ở đây?"*\n2. *"Đặc điểm mùa mưa và các đợt mưa cực đoan của trạm này?"*\n3. *"Nhận xét về kết quả dự báo trong các tháng tới?"*\n4. *"Tại sao không nên dự báo lượng mưa cho trạm Cam Ranh?"*`;
}

// Gọi API với Model được chỉ định
export async function askGemini(
  prompt: string,
  history: ChatMessage[],
  context: ContextData,
  selectedModel?: string
): Promise<string> {
  const apiKey = getStoredApiKey();
  const modelToUse = selectedModel || getStoredModel() || 'gemini-2.0-flash';

  const hasResult = !!(context.result && context.result.metrics && context.result.metrics.mae !== null);
  const metricsInfo = hasResult
    ? `- MAE: ${context.result!.metrics!.mae?.toFixed(2)} mm
- RMSE: ${context.result!.metrics!.rmse?.toFixed(2)} mm
- R²: ${context.result!.metrics!.r2 !== null ? context.result!.metrics!.r2!.toFixed(3) : 'Không xác định'}
- MAPE: ${context.result!.metrics!.mape !== null ? context.result!.metrics!.mape!.toFixed(1) + '%' : '—'} (trên ${context.result!.metrics!.n} mẫu kiểm thử)
- Dự báo các tháng tới:
${context.result!.forecast?.map(f => `  + Tháng ${f.date}: ${f.predicted?.toFixed(1)} mm (dải sai số: ${f.lower?.toFixed(0)} - ${f.upper?.toFixed(0)} mm)`).join('\n')}`
    : `(Người dùng CHƯA nhấn nút "Huấn luyện & đánh giá", hiện chưa có số liệu tính toán. Hãy nhắc người dùng nhấn nút này nếu họ hỏi về kết quả)`;

  const systemInstruction = `Bạn là Senior Climate Data Scientist và Chuyên gia Nghiên cứu Mưa lũ miền Trung tại nền tảng "CENTRAL FLOOD RESEARCH".
Nhiệm vụ của bạn là hỗ trợ sinh viên, giảng viên và nhà nghiên cứu phân tích dữ liệu khí tượng - thủy văn lịch sử (2016-2026), đánh giá các mô hình dự báo chuỗi thời gian (Ridge, Moving Average, v.v.).

THÔNG TIN NGỮ CẢNH NGHIÊN CỨU HIỆN TẠI:
- Trạm nghiên cứu: ${context.station} (${context.stationInfo?.province_name ?? ''})
- Mô hình: ${context.model}, thời hạn: ${context.horizon} tháng
- KẾT QUẢ TÍNH TOÁN THỰC TẾ:
${metricsInfo}

QUY TẮC BẮT BUỘC:
1. Khi người dùng hỏi về MAE, RMSE, R² hay Dự báo các tháng tới, BẠN PHẢI DÙNG CHÍNH XÁC CÁC CON SỐ TRÊN TRONG CÂU TRẢ LỜI. Tuyệt đối KHÔNG ĐƯỢC BÁO "đang tính toán" hay "chưa có kết quả" nếu ở trên đã có số liệu!
2. Trả lời khoa học, khách quan, súc tích, định dạng Markdown đẹp mắt (dùng tiêu đề ###, danh sách gạch đầu dòng, bôi đậm số liệu quan trọng).
3. Tuyệt đối không giả lập kết quả thành dự báo thời tiết thời gian thực hay cảnh báo thiên tai tức thời.
4. Chú ý đặc thù dữ liệu: Trạm Cam Ranh không có số đo mưa (n_rainfall = 0). Dữ liệu năm 2026 đang diễn ra chưa hoàn tất cả năm.`;

  const contents = [
    ...history.slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText;
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status}`;
      return `### Lỗi kết nối mô hình \`${modelToUse}\`\n${errMsg}\n\n*Hệ thống chuyển sang chế độ phân tích ngoại tuyến cho bạn:*\n\n${generateLocalResponse(prompt, context)}`;
    }
  } catch (err) {
    return `### Lỗi kết nối mạng: ${String(err)}\n\n*Phản hồi ngoại tuyến từ hệ thống:*\n\n${generateLocalResponse(prompt, context)}`;
  }

  return generateLocalResponse(prompt, context);
}
