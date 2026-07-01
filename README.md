# vBook Wrapped

Bảng thống kê hành trình đọc sách (Wrapped) cá nhân hóa dành cho người dùng ứng dụng **vBook**.

## Tính năng chính
* **Phân tích tệp sao lưu:** Hỗ trợ đọc trực tiếp tệp backup từ vBook (`.zip`, `.tar`, `.tar.zst`) lên tới 500MB.
* **Bảo mật tuyệt đối:** Xử lý dữ liệu 100% offline bằng Web Worker trực tiếp ngay trên trình duyệt (không gửi lên server).
* **Thống kê chi tiết:**
  * Tổng số giờ đọc/nghe sách.
  * Cuốn sách nổi bật nhất năm (hiển thị bìa 3D).
  * Xếp hạng danh hiệu độc giả (Archetype) & thành tựu đạt được.
  * Tổng kết số chương, số sách, số ghi chú và chuỗi ngày hoạt động.
* **Lưu ảnh Poster:** Xuất báo cáo thống kê thành ảnh PNG chất lượng cao để chia sẻ.

## Công nghệ sử dụng
* React + TypeScript + Vite
* `fflate` & `fzstd` (giải nén tệp sao lưu cực nhanh)
* `html-to-image` (chuyển đổi canvas/giao diện sang ảnh)
