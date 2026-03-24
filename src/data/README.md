# 🗄️ Data Directory (Tầng Dữ liệu)

Thư mục này chịu trách nhiệm định nghĩa **hình hài (shape)** của dữ liệu đi vào và đi ra khỏi hệ thống, cũng như giao tiếp với Database. 

**QUY TẮC TỐI THƯỢNG:** Thư mục này chỉ quan tâm dữ liệu "trông như thế nào", không quan tâm dữ liệu "được xử lý ra sao".

## 📂 Cấu trúc thư mục:
* **`/dtos` (Data Transfer Objects)**: Chứa các file định nghĩa dữ liệu giao tiếp giữa Client và Server.
  * `/create`: Validate dữ liệu khi tạo mới (vd: `CreateUserDto`, Zod schemas).
  * `/update`: Validate dữ liệu khi cập nhật (thường dùng chung hoặc kế thừa từ CreateDto nhưng các field là optional).
* **`/entities`**: Định nghĩa cấu trúc các đối tượng thực thể (Nếu dùng Prisma, tầng này có thể chỉ chứa type trích xuất từ Prisma schema).
* **`/migration`**: Lịch sử các file SQL thay đổi cấu trúc Database (Thường do ORM tự động sinh ra).

## 💡 Khi nào thêm file vào đây?
Khi bạn cần tạo một Zod Schema để kiểm tra xem `req.body` người dùng gửi lên lúc đăng ký có hợp lệ không, hãy tạo file ở `dtos/create/register.dto.ts`.