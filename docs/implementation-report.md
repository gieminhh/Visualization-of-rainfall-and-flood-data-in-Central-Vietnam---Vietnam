> Cập nhật 25/10/2026: AI Lab, nhập CSV và báo cáo đã được triển khai chạy thật theo yêu cầu bổ sung. Xem [chức năng nghiên cứu](research-workflows.md). Các phần khảo sát bên dưới mô tả giai đoạn xử lý dữ liệu ban đầu.

# Báo cáo hoàn thiện logic dữ liệu

## Kiểm tra mã nguồn ban đầu

Đã đọc mockData.ts, real_dataset.json, dataService.ts, types/index.ts, utils/index.ts, components/charts/index.tsx (dự án dùng .tsx, không có index.ts), AnalysisPage.tsx, OverviewPage.tsx và DataQualityPage.tsx trước khi sửa.

- real_dataset.json chứa metadata, 103 bản tin, 35 mô tả, tổng hợp tháng/năm/chất lượng và 7 số mưa cực lớn; không chứa quan trắc ngày. Đây là bản tổng hợp có sẵn, chưa có quy trình tái tạo trong dự án.
- mockData.ts thực chất xuất lại snapshot đó; SUMMARY_STATS có tỷ lệ 94,2% và số tỉnh ghi cố định. Ba trang nghiên cứu đọc trực tiếp snapshot, có nhiều mô tả, ngày, số trạm và khẳng định chất lượng ghi cố định.
- Biểu đồ tháng/năm dùng `val ?? 0`; so sánh sắp xếp chuỗi nhãn hiển thị và bỏ điểm null. Bộ lọc ngày chỉ so sánh năm.
- AI Lab dùng số mẫu và Math.random, đã có nhãn demo. Giữ chức năng mô phỏng, sửa chú giải biểu đồ để không gọi lịch sử mô phỏng là “Thực tế”. Notebook là ghi chú người dùng, không phải dữ liệu đo.

## Nguồn và pipeline mới

Ban đầu không có data/raw/. Tìm thấy đủ sáu CSV trong thư mục outputs bên cạnh; đã sao chép nguyên byte vào data/raw/. Không thiếu tệp và không tạo quan trắc thay thế.

CSV → kiểm tra tiêu đề/khóa/ngày/danh mục → chuẩn hóa null, số và thời gian → nối cờ chất lượng → JSON có manifest → service lọc/tổng hợp → frontend.

Đối soát: 48.187 dòng khí tượng, 48.187 dòng chất lượng, ghép đủ toàn bộ; 13 trạm, 14 tỉnh/thành trong danh mục (10 tỉnh có khí tượng); 103 số đo mực nước; 35 mô tả. Khoảng ngày khí tượng 2016-01-01 đến 2026-09-30. Bảy số mưa cực lớn giữ nguyên, có trạng thái cần kiểm chứng.

## Tổng hợp và độ đầy đủ

- `aggregateDaily`, `aggregateMonthly`, `aggregateYearly`: tổng mưa từ số hợp lệ; nhiệt độ/độ ẩm trung bình trên số hợp lệ; không lấy trung bình không trọng số của các trung bình tháng. Không có số mưa hợp lệ thì null; đủ số 0 vẫn là 0.
- Sắp xếp theo nhãn ISO ngày hoặc năm/tháng số. Có thể tạo ô tổng hợp rỗng để biểu đồ thể hiện khoảng trống, nhưng không tạo bản ghi quan trắc.
- `calculateCompleteness`: số ngày-trạm kỳ vọng là số ngày lịch trong khoảng đang xét nhân số trạm được chọn. Không cắt mẫu số theo ngày đầu/cuối riêng từng trạm, vì như vậy sẽ che các khoảng thiếu. Số ngày có bản ghi, mưa, nhiệt độ, độ ẩm hợp lệ đếm riêng theo khóa trạm-ngày.
- Mặc định khoảng quan sát toàn bộ là 2016-01-01–2026-09-30; bộ lọc xác định khoảng kỳ vọng khác khi được chọn. Từng năm tính trên phần khoảng quan sát/bộ lọc giao với năm đó. Năm 2026 có mẫu số đến 30/09 nhưng luôn có cảnh báo chưa trọn năm. Chọn trọn năm sẽ dùng đủ 365/366 ngày.
- `is_partial_year`: khoảng chọn hoặc số ngày có bản ghi chưa bao phủ năm lịch. `is_complete_year`: đủ mọi ngày và đủ cả ba chỉ số khí tượng. Đủ ngày có bản ghi không đồng nghĩa đủ giá trị từng chỉ số. Cờ cần kiểm chứng và nguồn được giữ riêng, kể cả khi độ đầy đủ là 100%.
- Tổng quan hiện tính 51.038 ngày-trạm kỳ vọng, 48.187 có bản ghi (94,41%); 39.489 mưa hợp lệ (77,37%), 47.228 nhiệt độ (92,53%), 44.655 độ ẩm (87,49%). Đây là độ đầy đủ theo quy tắc nguồn, không phải tỷ lệ đã đối soát/chứng nhận.
- Service lọc theo giao của trạm, tỉnh, ngày bao gồm hai đầu; chọn chỉ số không xóa các ngày thiếu. Biểu đồ/bảng/nghiên cứu so sánh lấy dữ liệu cùng bộ lọc. Mực nước chỉ hiển thị bảng bản tin riêng theo giờ Việt Nam; không cộng, nội suy hoặc tạo chuỗi mực nước ngày.

## Các file đã sửa

- package.json: lệnh chuẩn hóa, test, typecheck; tự chuẩn hóa trước dev/build.
- tsconfig.json: bổ sung kiểm tra TypeScript cho pipeline và test.
- src/types/index.ts: kiểu null, chất lượng, nguồn, completeness, manifest và service.
- src/services/dataService.ts: tải JSON, khôi phục liên kết chất lượng, bộ lọc và API bất đồng bộ.
- src/data/mockData.ts: chỉ còn gợi ý nghiên cứu tĩnh; bỏ xuất số liệu snapshot và tỷ lệ cố định.
- src/utils/index.ts: số không hữu hạn, trung bình hợp lệ, định dạng ngày UTC/giờ Việt Nam.
- src/components/charts/index.tsx: giữ null, tooltip, thứ tự thời gian, nhãn mô phỏng.
- src/components/maps/StationMap.tsx: phân biệt số ngày mưa hợp lệ với số ngày có mưa.
- src/components/layout/Sidebar.tsx: số bản ghi/trạm từ manifest.
- src/pages/OverviewPage.tsx, src/pages/AnalysisPage.tsx, src/pages/DataQualityPage.tsx: nối service, bộ lọc, empty state, cảnh báo và metadata đúng nguồn; giữ cấu trúc trang, tabs, bảng, bản đồ và phong cách hiện có.
- src/pages/AILabPage.tsx: danh mục trạm từ service, giữ demo hiện có.
- README.md: cách chạy và giới hạn.

## Các file mới

- scripts/process-data.ts
- src/services/dataProcessing.ts
- tests/dataProcessing.test.ts và tests/ingestion.test.ts
- tsconfig.data.json
- docs/data-processing.md và docs/implementation-report.md
- data/raw/Dataset_ngay.csv, data/raw/Tram_do.csv, data/raw/Tinh_thanh.csv, data/raw/Muc_nuoc_ban_tin.csv, data/raw/Chat_luong.csv, data/raw/Mo_ta.csv
- public/data/normalized_dataset.json (tự sinh; chất lượng dùng chỉ số để tránh lưu trùng)

src/data/real_dataset.json được giữ nguyên như snapshot lịch sử để không mất dữ liệu cũ, nhưng không còn được import bởi frontend hoặc service. dist/ và thông tin build được tái tạo khi build. Khi bắt đầu triển khai thư mục chưa có Git. Khi bàn giao lên GitHub, đã nối lịch sử main của repository nghiên cứu và giữ nguyên các CSV, workbook cùng sơ đồ ERD có sẵn.

## Kiểm thử và giới hạn

29 kiểm thử tự động bao phủ sáu yêu cầu bắt buộc: tháng thiếu mưa → null; tháng đầy đủ 0 mm → 0; cảnh báo năm thiếu; trung bình bỏ qua giá trị thiếu; bộ lọc đúng; tổng dòng khớp CSV. Có thêm kiểm thử khóa ghép, nguồn/hash, cờ kỳ mưa, số giờ RH, ngày nhuận, UTC/ICT, cực trị, lỗi parser và không ghi đè đầu ra khi xử lý thất bại.

Giới hạn hiện tại: chưa có backend đồng bộ; dự báo Ridge và trung bình mùa vụ chạy trên trình duyệt; chưa xác thực khoa học 7 số mưa cực lớn; không bổ sung các khoảng thiếu. CSV upload kiểm tra và thay bộ dữ liệu trên trình duyệt qua IndexedDB. JSON chuẩn hóa khoảng 46,4 MB chưa nén, tải một lần và giữ cache trong phiên; khi triển khai mạng nên cấu hình HTTP compression hoặc tách dữ liệu theo trạm. Đây chưa phải bước triển khai hosting.

## Kết quả kiểm tra bàn giao

- `npm test`: 29/29 đạt, không có bài bỏ qua hoặc thất bại.
- `npm run typecheck`: đạt; kiểm tra cả frontend, script xử lý CSV và các bài test.
- Kiểm tra trình duyệt: Tổng quan Cam Ranh/mưa hiển thị empty state, chuyển nhiệt độ có biểu đồ; Phân tích lọc đúng Phú Bài ngày 09/10/2020 thành một dòng 560,5 mm và gắn cờ cần kiểm chứng; mực nước ngày 13/02/2016 hiển thị bản tin Ái Nghĩa 19:00 giờ Việt Nam, 2,04 m; trang Chất lượng lọc Cam Ranh cho 0 ngày mưa hợp lệ nhưng vẫn giữ số ngày nhiệt độ/độ ẩm riêng. Đã kiểm tra bố cục trực quan của trang Chất lượng.
- `npm run lint`: exit 0, còn 24 cảnh báo advisory về biến/import chưa dùng, Date trong Notebook và cập nhật trạng thái tải trong React effect. Không phải lỗi chặn build; chưa thực hiện đợt dọn lint ngoài phạm vi xử lý dữ liệu.
- Pipeline không ghi lại JSON khi nội dung không đổi. Khi Windows khóa tệp đã thay đổi, thử lại tối đa năm lần, giữ đầu ra cũ nếu vẫn lỗi. Nếu gặp EPERM kéo dài, dừng dev server hoặc ứng dụng đang giữ tệp rồi chạy lại. Bản build đã chạy thành công sau khi dừng dev server trong lần kiểm tra trước.
`npm run build` đã chạy lại thành công ở lượt bàn giao cuối (24/10/2026), gồm chuẩn hóa CSV và TypeScript. Còn cảnh báo bundle JavaScript khoảng 971 kB sau minify (285 kB gzip), vượt ngưỡng khuyến nghị 500 kB; không có lỗi build. JSON dữ liệu được tải riêng, không nhúng vào bundle JavaScript.

Đóng gói GitHub: bỏ qua node_modules/, dist/, *.tsbuildinfo và JSON sinh tự động; pretest tạo lại JSON trước khi kiểm thử trên bản clone mới. .gitattributes giữ nguyên byte CSV. Đã bổ sung .gitignore, .gitattributes và README tương ứng.


## Bổ sung chức năng ngày 25/10/2026

- Bỏ số ngẫu nhiên, số đánh giá và lịch sử mẫu ở AI Lab; thay bằng Ridge và baseline mùa vụ, kiểm thử cuốn chiếu không dùng dữ liệu tương lai. Chưa triển khai SARIMA/XGBoost.
- Nhập đủ sáu CSV, dùng chung bộ chuẩn hóa với CLI; lưu giao dịch IndexedDB và tải lại các trang sau khi áp dụng. Giữ nguồn đang dùng nếu kiểm tra/lưu thất bại.
- Sổ tay nhận kết quả thực từ AI Lab; xuất HTML/Markdown và bản in để lưu PDF. Escape nội dung người dùng và báo lỗi lưu.
- 39/39 bài kiểm thử đạt, bao gồm dự báo, nhập CSV, lưu cục bộ và báo cáo. TypeScript và bản build đạt.
- Đã thao tác trình duyệt chạy Phú Bài, xem chỉ số, mở lại lịch sử, thêm sổ tay và tải HTML; tệp tải chứa đúng kết quả và hash nguồn.
- Kiểm tra nhập CSV trên giao diện: thiếu tệp báo lỗi; chọn đủ 6 tệp → 48.187 bản ghi, ghép đủ chất lượng; áp dụng và tải lại hiện CSV đã nhập; dùng lại nguồn gốc thành công. Kiểm thử thêm xác nhận bộ nhập nhỏ hơn thật sự đổi số bản ghi và hash giữ nguyên cả BOM UTF-8.
- Bản in chứa đầy đủ các block; tệp HTML tải xuống đã đối chiếu với phiên nghiên cứu. Biểu đồ dự báo và khoảng thiếu được kiểm tra trực quan.
