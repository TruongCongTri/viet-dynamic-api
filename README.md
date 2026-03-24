# ⚙️ Viet Dynamic Core API

Đây là hệ thống Back-end cung cấp RESTful API cho nền tảng E-learning **Viet Dynamic**. Hệ thống đảm nhiệm việc quản lý dữ liệu người dùng, tiến trình học tập, bảo mật (Authentication) và tích hợp cổng thanh toán (Payment Gateway).

## 🛠 Tech Stack

- **Lõi hệ thống:** [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/)
- **Ngôn ngữ:** TypeScript
- **Database & ORM:** PostgreSQL, [Prisma](https://www.prisma.io/)
- **Bảo mật & Auth:** JWT, bcryptjs, Helmet, express-rate-limit
- **Validation:** Zod

## 📋 Yêu cầu hệ thống (Prerequisites)

- Node.js >= 18.x
- PostgreSQL >= 14.x (Đã cài đặt local hoặc dùng Cloud DB như Supabase/Neon)

## ⚙️ Cấu hình Biến môi trường (.env)

Tạo một file `.env` ở thư mục gốc và cung cấp các thông tin sau:

### Cấu hình Server

```env
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Cấu hình Database
DATABASE_URL="postgresql://user:password@localhost:5432/viet_dynamic?schema=public"

### Bảo mật (JWT)

```env
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
```

### Cổng thanh toán VNPAY/MoMo (Sandbox)

```env
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
```

## 🚀 Hướng dẫn Cài đặt & Chạy Local
### Clone dự án về máy:

```end
git clone [https://github.com/your-org/viet-dynamic-api.git](https://github.com/your-org/viet-dynamic-api.git)
cd viet-dynamic-api
```

### Cài đặt thư viện:

```env
npm install
```

### Thiết lập Database (Prisma):

```env
# Tạo cấu trúc bảng dưới database
npx prisma db push 
# Sinh type cho Prisma Client
npx prisma generate
```

### Khởi chạy môi trường Development:

```env
npm run dev
```

Server sẽ chạy tại: http://localhost:8000

## 📂 Cấu trúc thư mục chính

```env
src/
 ┣ config/              # Cấu hình biến môi trường, third-party API
 ┣ controllers/         # Xử lý logic Request/Response
 ┣ middlewares/         # Bộ lọc request (Auth, Rate Limit, Error Handler)
 ┣ routes/              # Định tuyến các Endpoints (API Routes)
 ┣ services/            # Chứa core logic (Payment, Course tracking)
 ┣ crons/               # Các tác vụ chạy ngầm (Cronjobs)
 ┗ index.ts             # File khởi chạy Server chính
prisma/
 ┗ schema.prisma        # Sơ đồ thiết kế Database (Models)
```

## 📜 Các Lệnh (Scripts) khả dụng

npm run dev: Chạy server dev với ts-node-dev (Hot-reload).

npm run build: Compile TypeScript sang JavaScript (thư mục dist/).

npm run start: Chạy server Production từ thư mục dist/.
