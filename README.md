# Central Flood Research

Frontend nghiên cứu mưa lũ miền Trung: React, TypeScript, Vite. Giữ giao diện Scientific Light; dữ liệu nghiên cứu được đọc từ sáu CSV gốc, qua kiểm tra và chuẩn hóa trước khi hiển thị.

## Chạy dự án

Yêu cầu Node.js 24 trở lên và các dependency trong package-lock.json.

```sh
npm ci
npm run dev
```

`dev`, `test` và `build` tự chạy bước chuẩn hóa dữ liệu. JSON đầu ra được tạo cục bộ, không lưu trong Git. Có thể chạy riêng:

```sh
npm run data:process
npm test
npm run typecheck
npm run build
npm run preview
```

Sáu CSV bắt buộc đặt trong `data/raw/`: Dataset_ngay.csv, Tram_do.csv, Tinh_thanh.csv, Muc_nuoc_ban_tin.csv, Chat_luong.csv, Mo_ta.csv. Nếu thiếu hoặc sai cấu trúc, quá trình dừng và giữ nguyên JSON hợp lệ gần nhất; không tạo dữ liệu thay thế.

Các CSV, workbook Excel và sơ đồ ERD ở thư mục gốc được giữ lại từ repository nghiên cứu ban đầu. Pipeline frontend đọc bản nguồn trong `data/raw/`.

Đọc [quy trình và nguyên tắc dữ liệu](docs/data-processing.md) và [báo cáo triển khai, kiểm thử, danh sách file](docs/implementation-report.md).

## Phạm vi

- Tổng quan, Phân tích và Chất lượng sử dụng Data Service bất đồng bộ, không dùng số liệu mẫu.
- AI Lab là giao diện DEMO đã có; kết quả lịch sử/dự báo đều là mô phỏng, không dùng cho nghiên cứu thật. Chưa triển khai AI/backend.
- Sổ tay giữ nguyên chức năng hiện có.
- Nhập CSV trên giao diện chỉ kiểm tra cấu trúc và xem trước, chưa cập nhật bộ dữ liệu nghiên cứu.
