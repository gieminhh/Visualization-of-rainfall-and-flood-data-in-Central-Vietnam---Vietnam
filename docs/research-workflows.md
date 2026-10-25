# Chức năng nghiên cứu chạy từ dữ liệu thật

## Nhập CSV

`src/services/csvNormalization.ts` chứa cùng một bộ quy tắc cho script Node và trình duyệt. Script giữ API cũ, dùng SHA-256 từ Node; trình duyệt dùng Web Crypto. Kiểm thử đối chiếu toàn bộ kết quả hai đường xử lý.

Giao diện nhận một bộ gồm sáu CSV liên quan, giữ tên tệp quy định. Kiểm tra cột, ngày, khóa trạm/tỉnh, chất lượng, null và hash trước khi cho áp dụng. Đây là thay bộ nguồn, không phải nối từng tệp riêng. Các cảnh báo chất lượng hiển thị trước khi áp dụng, giá trị cần kiểm chứng không biến thành đã xác thực.

IndexedDB lưu bộ chuẩn hóa trong một giao dịch. Chỉ tải lại ứng dụng sau khi giao dịch hoàn thành. Lỗi kiểm tra hoặc lỗi lưu không xóa nguồn đang dùng. Nút dùng lại nguồn dự án xóa bản nhập cục bộ rồi tải JSON của dự án. CSV gốc không bị sửa. Các tab khác cần tải lại; không có đồng bộ tài khoản/máy khác.

## Dự báo và đánh giá

- Ridge: giải hệ bình phương tối thiểu có điều chuẩn α = 1, không phạt hệ số chặn. Đặc trưng: xu hướng tháng chia 120, sin/cos chu kỳ năm với ba bậc hài. Dự báo lượng mưa âm được chặn tại 0.
- Đối chiếu: trung bình các tổng mưa cùng tháng trong tập huấn luyện. Không dùng nhãn SARIMA hoặc XGBoost cho hai mô hình này.
- Chuỗi vào là tổng mưa tháng của một trạm. Chỉ tháng có đủ ngày hợp lệ theo lịch được dùng. Tháng thiếu giữ null; không nội suy, không điền 0, không coi tháng bị cắt bởi phạm vi nguồn là đủ.
- Cần ít nhất 36 tháng đầy đủ toàn nguồn. Mỗi mốc kiểm thử cần tối thiểu 24 tháng đầy đủ trước mốc và đủ các tháng trong năm.
- Duyệt mốc cuốn chiếu theo thứ tự thời gian, giữ tối đa 12 mốc gần nhất có đủ giá trị thực cho mọi hạn 1–h. Mỗi lần chỉ huấn luyện trên dữ liệu trước mục tiêu. Yêu cầu tối thiểu 6 mẫu cho mỗi hạn. Hai mô hình đánh giá cùng mốc.
- MAE, RMSE, R² tính trên từng cặp dự báo/quan trắc; các mốc có thể chồng lấp tháng mục tiêu ở các hạn khác nhau. MAPE loại quan trắc bằng 0 và hiển thị số mẫu còn lại. R² null khi quan trắc không biến thiên.
- Khoảng sai số dùng phân vị 90% sai số tuyệt đối của kiểm thử theo từng hạn. Đây không phải khoảng tin cậy được hiệu chuẩn và không bảo đảm bao phủ 90%.
- Dự báo bắt đầu sau tháng cuối nguồn. Phần đầu/cuối nguồn thiếu và khoảng cách đến tháng đầy đủ cuối được hiển thị. Đánh giá trên tháng đầy đủ có thể thiên lệch so với các giai đoạn thiếu, không khẳng định độ chính xác cho thời gian hiện tại.

Kết quả, mốc kiểm thử, cấu hình, thời gian chạy và hash nguồn được lưu cùng nhau. Thay đổi cấu hình không sửa kết quả đã chạy. Lịch sử tối đa 30 lần chạy nằm trong localStorage của trình duyệt; lỗi lưu hiện rõ. Nút tải JSON giữ kết quả để đối chiếu ngoài ứng dụng.

## Báo cáo

AI Lab có nút tạo phiên sổ tay từ lần chạy hiện tại, gồm phương pháp, nguồn/hash, độ đầy đủ, chỉ số kiểm thử và dự báo. Người dùng sửa nội dung, thứ tự block và xuất HTML/Markdown. HTML escape nội dung người dùng; không thực thi HTML từ ghi chú.

Nút In / Lưu PDF tạo bản in riêng có khổ A4, tiếng Việt và toàn bộ các block, rồi gọi hộp thoại in trình duyệt. Chọn Lưu dưới dạng PDF. Trình duyệt nhúng có thể không hỗ trợ tải/in; dùng Chrome/Edge khi cần xuất. Chức năng này không cần backend hoặc dịch vụ bên thứ ba.

## Kiểm thử bổ sung

Kiểm thử hồi quy học từ dữ liệu, dự báo mùa vụ với chuỗi có nghiệm biết trước, không nhìn thấy dữ liệu tương lai, thiếu dữ liệu, MAPE/R² không xác định; kiểm thử cùng kết quả nhập CLI/trình duyệt, lưu/đọc/xóa IndexedDB, không đổi nguồn khi nhập sai; kiểm thử escape HTML và giữ thứ tự báo cáo. Chạy `npm test`, `npm run typecheck`, `npm run build`.
