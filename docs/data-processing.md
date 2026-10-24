# Quy trình dữ liệu CSV

Chạy `npm run data:process` bằng Node.js 24 trở lên. Script đọc đúng sáu tệp
trong `data/raw/`, kiểm tra cấu trúc rồi ghi `public/data/normalized_dataset.json`.
`npm run dev` và `npm run build` cũng chạy bước này trước khi khởi động/build.
Nếu thiếu tệp, sai cột, ngày không hợp lệ, khóa trùng hoặc sai danh mục trạm/tỉnh,
script dừng với lỗi và giữ nguyên JSON đã có. Không tự tải hoặc tạo dữ liệu thay thế.

Sáu tệp được sao chép nguyên byte từ bộ nguồn đã có tại
`../outputs/rain_flood_20261005/csv_20261016_01a14515/`. Tệp `Mo_ta.csv` được giữ
nguyên và dùng làm hợp đồng ngữ nghĩa, đặc biệt về ngày UTC và kỳ tích lũy mưa.
Manifest lưu SHA-256 từng tệp, số dòng đầu vào/đầu ra và số ghép chất lượng.

## Quy tắc chuẩn hóa

- Ô số trống thành `null`; số 0 giữ nguyên. Giá trị không hữu hạn hoặc ngoài
  khoảng kiểm tra bị chuyển thành `null`, kèm vấn đề và giá trị gốc trong
  `raw_values`. Khoảng kiểm tra: mưa ≥0, nhiệt độ −100 đến 70 °C, RH 0–100%,
  vĩ độ −90 đến 90°, kinh độ −180 đến 180°. Khoảng nhiệt độ chỉ là kiểm tra
  lỗi cấu trúc rộng; nằm trong khoảng không có nghĩa là đã xác thực khoa học.
- `Dataset_ngay.datetime` và `Chat_luong.datetime` là **nhãn ngày UTC**, chuẩn hóa
  thành `YYYY-MM-DD`; không chuyển nhãn này sang ngày Việt Nam.
- Chất lượng ghép bằng tên trạm + ngày đầy đủ, sau đó kiểm tra `source_station_id`
  với danh mục trạm. Không ghép được thì giữ dòng, gắn `unmatched` và đếm riêng.
- Mưa chỉ dùng khi cờ D/F/G/24 và trạng thái FULL_24H hoặc
  EXTREME_GE_500MM_REQUIRES_CHECK. A/B/C/E, H/I và kỳ chưa xác nhận không được
  biến thành lượng mưa ngày, kể cả khi số gốc là 0. RH cần OK_MIN4 và ≥4 giờ.
  Việc loại một chỉ số không loại các chỉ số hợp lệ khác trên cùng dòng.
- Bảy số mưa ≥500 mm được giữ nguyên và gắn `requires_review`. `source_reported`
  chỉ có nghĩa là số nguồn cung cấp, không có nghĩa đã được KTTV đối soát.
- `Muc_nuoc_ban_tin` giữ thành bảng riêng. Giờ Việt Nam được biểu diễn với hậu tố
  `+07:00`, có `original_datetime`, `timezone`, loại quan trắc và URL từng dòng.
  Không điền tọa độ thiếu, nội suy mực nước hoặc ghép sang trạm khí tượng.
- `source_row` là thứ tự bản ghi CSV tính cả dòng tiêu đề (bản ghi đầu tiên là 2).
  `source_url` khí tượng được suy ra bằng cách thay năm trong URL mẫu của trạm,
  theo hướng dẫn `Mo_ta.csv`; đây là đường dẫn truy nguyên, chưa kiểm tra trực tuyến.

## Dạng JSON

JSON vận chuyển phiên bản `1.1.0` chứa `daily_records`, `quality_records`,
`stations`, `provinces`, `river_records`, `descriptions`, `manifest`.
Để tránh lưu mỗi dòng chất lượng hai lần, `manifest.quality_encoding` là
`indexed-v1` và mỗi dòng khí tượng lưu `quality_index` trỏ chính xác tới bảng
`quality_records` (hoặc `null` nếu không ghép được). Data Service khôi phục trường
`quality` khi tải. Không được nối lại bằng tên trạm đơn lẻ.

Hàm thuần `normalizeDataset()` trả đối tượng đã nối `quality` đầy đủ;
`createTransportDataset()` chuyển sang biểu diễn có chỉ số trước khi ghi tệp.
Các hàm parser và chuẩn hóa được xuất để kiểm thử, không có thao tác ghi tệp
khi import script. Đầu ra có tính xác định với cùng sáu đầu vào.

## Đối soát bộ nguồn hiện tại

- 48.187 dòng khí tượng; 48.187 dòng chất lượng; ghép đủ 48.187, không mồ côi.
- 13 trạm, 14 tỉnh/thành trong danh mục, 103 quan trắc mực nước rời rạc,
  35 dòng mô tả. Khí tượng thực có ở 10 tỉnh/thành.
- Ngày khí tượng từ 2016-01-01 đến 2026-09-30; không tạo thêm ngày quan trắc.
- Không phát hiện khóa trùng hoặc giá trị ngoài khoảng kiểm tra; 7 dòng mưa
  cực lớn cần kiểm chứng. Dữ liệu có nhiều khoảng trống và năm 2026 chưa đủ năm.

Chạy `npm test` để kiểm tra đối soát nguồn, phép ghép, kỳ tích lũy, null/0,
ngày giờ, bảo toàn tệp khi lỗi và các phép tổng hợp ở frontend.

Khi đầu vào không đổi, đầu ra JSON giữ nguyên để tránh reload và thay tệp không cần thiết. Ghi mới dùng tệp tạm riêng và đổi tên nguyên tử, có thử lại lỗi khóa tệp Windows; nếu vẫn bị khóa thì báo lỗi và giữ bản trước. Dừng dev server nếu cần tái tạo dữ liệu đã thay đổi trên Windows. Bản tin mực nước bắt buộc có giờ quan trắc gốc; không tự tạo giờ 00:00 từ ngày thiếu giờ.
