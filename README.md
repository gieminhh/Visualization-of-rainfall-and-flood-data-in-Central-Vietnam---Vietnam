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
- AI Lab huấn luyện hồi quy Ridge và mô hình trung bình cùng tháng từ dữ liệu thật; kiểm thử cuốn chiếu, tính MAE/RMSE/MAPE/R², lưu tối đa 30 lần chạy và xuất JSON. SARIMA/XGBoost chưa được triển khai. Không sinh kết quả ngẫu nhiên.
- Nhập CSV: chọn đủ sáu tệp trong Nguồn & chất lượng dữ liệu → Nhập bộ dữ liệu CSV → xem kết quả kiểm tra → Áp dụng. Bộ nguồn mới thay toàn bộ dữ liệu phân tích trên trình duyệt này, lưu bằng IndexedDB và giữ sau khi tải lại. Có nút dùng lại dữ liệu gốc dự án. Không đồng bộ giữa các máy.
- Sổ tay nhận kết quả từ AI Lab, cho phép biên tập, tải báo cáo HTML/Markdown hoặc mở hộp thoại In để lưu PDF. Lỗi lưu trình duyệt được hiển thị, không báo lưu thành công giả.

## Thử chức năng

1. Vào AI Research Lab, chọn Phú Bài, nhấn **Huấn luyện & đánh giá**. Xem tab Đánh giá mô hình để đối chiếu từng dự báo với quan trắc. Cam Ranh thiếu mưa nên phải báo không đủ dữ liệu.
2. Nhấn **Thêm vào sổ tay**, mở **Sổ tay & báo cáo**, chọn **In / Lưu PDF** (dùng trình duyệt có hỗ trợ in, như Chrome/Edge), hoặc tải HTML/Markdown.
3. Nhập đủ bộ CSV ở tab 5 của trang Chất lượng. Thanh bên đổi thành **CSV đã nhập** sau khi áp dụng. Bộ sai cấu trúc không thay thế dữ liệu hiện tại.

Mô hình chỉ học tháng có đủ ngày mưa hợp lệ. Kiểm thử dùng tối đa 12 mốc gần nhất có đủ quan trắc cho mọi hạn dự báo, không nhất thiết là 12 tháng liên tiếp. Giao diện hiển thị tháng đầy đủ gần nhất và giai đoạn kiểm thử. Khoảng sai số là phân vị 90% sai số tuyệt đối thực nghiệm, chưa hiệu chuẩn xác suất. Dự báo từ dữ liệu lịch sử không phải cảnh báo thời tiết thời gian thực. Chi tiết tại [chức năng nghiên cứu](docs/research-workflows.md).
