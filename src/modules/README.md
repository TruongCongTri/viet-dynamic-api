# 🧩 Modules Directory (Tầng Nghiệp Vụ)

Đây là "trái tim" của hệ thống. Toàn bộ logic ứng dụng được chia thành các **Modules** (tính năng) độc lập theo phương pháp Domain-Driven Design (Thiết kế hướng luồng nghiệp vụ).

**QUY TẮC TỐI THƯỢNG:** Một module nên độc lập nhất có thể. Module `auth` chỉ nên chứa những gì liên quan đến đăng nhập/đăng ký. Code của module này không được gọi trực tiếp Controller hay Route của module khác.

## 📂 Cấu trúc một Module chuẩn (vd: `/auth`):
1. **`auth.route.ts`**: Nơi định nghĩa các endpoint (URL). Chỉ làm nhiệm vụ điều hướng Request tới đúng Controller.
2. **`auth.controller.ts`**: Nhận Request từ Route, gọi Schema từ tầng `/data` để validate, truyền dữ liệu xuống Service xử lý, và trả Response về cho Client. **Không viết logic if/else nghiệp vụ ở đây.**
3. **`auth.service.ts`**: Chứa 100% não bộ của tính năng. Xử lý logic, tính toán, mã hóa, tương tác với Database.

## 🧭 Luồng chạy dữ liệu (Data Flow):
`Client` ➡️ `Route` ➡️ `Middleware (Auth/Validate)` ➡️ `Controller` ➡️ `Service` ➡️ `Database` (và ngược lại).

## 💡 Khi nào tạo Module mới?
Khi dự án có một danh từ/thực thể mới hoàn toàn cần quản lý. (Ví dụ: Thêm chức năng cấp Chứng chỉ -> Tạo thư mục `modules/certificate`).