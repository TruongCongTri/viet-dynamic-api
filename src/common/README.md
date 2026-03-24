# 🛠️ Common Directory (Tầng Tiện Ích Chung)

Thư mục này chứa các đoạn code, cấu hình và công cụ được chia sẻ và sử dụng ở **nhiều nơi khác nhau** trong toàn bộ hệ thống. 

**QUY TẮC TỐI THƯỢNG:** Không bao giờ được phép chứa logic nghiệp vụ (Business Logic) cụ thể của một tính năng nào ở đây (ví dụ: không có logic tạo khóa học hay tính tiền thanh toán).

## 📂 Cấu trúc thư mục:
* **`/configs`**: Biến môi trường (`env.ts`), cấu hình bên thứ 3 (VNPAY, MoMo, AWS).
* **`/errors` & `/exceptions`**: Định nghĩa các class lỗi tùy chỉnh (Custom Errors) như `NotFoundError`, `UnauthorizedError` để đồng bộ chuẩn báo lỗi.
* **`/helpers`**: Các hàm tiện ích thuần túy (format ngày tháng, hash mật khẩu, regex validate).
* **`/utils`**: Các hàm tiện ích thuần túy (format ngày tháng, hash mật khẩu, regex validate).
* **`/middlewares`**: Các bộ lọc Request của Express (Xác thực token, Phân quyền Admin, Rate limit).
* **`/responses`**: Chuẩn hóa format trả về cho Client (vd: `{ status: 'success', data: ... }`).
* **`/types`**: Định nghĩa TypeScript interfaces/types dùng chung cho toàn dự án.

## 💡 Khi nào thêm file vào đây?
Nếu bạn viết một hàm hay một type mà bạn nghĩ rằng "Cả module Auth và module Course đều sẽ cần dùng cái này", hãy đặt nó vào đây.