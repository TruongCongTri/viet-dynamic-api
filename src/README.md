# 🚀 Viet Dynamic API - Source Code

Chào mừng đến với mã nguồn Backend của Viet Dynamic. Kiến trúc này được thiết kế theo mô hình **Layered Architecture + Feature Modules** để đảm bảo khả năng mở rộng (Scalability) và dễ bảo trì (Maintainability) cho môi trường Enterprise.

* **`server.ts`**: Entry point. Nơi kết nối Database và chạy `app.listen()`.
* **`app.ts`**: Cấu hình Express core (CORS, Helmet, Body Parser).
* **`router.ts`**: Trạm trung chuyển chính. Nơi import tất cả các `*.route.ts` từ thư mục `modules/` và gắn tiền tố `/api/v1/...`.

📌 **Quy trình Dev:** Nhớ chạy `npm run lint` và `npm run format` trước khi commit. Husky sẽ tự động kiểm tra type TypeScript của bạn!