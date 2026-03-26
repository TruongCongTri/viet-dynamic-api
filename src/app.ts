import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from '@/common/configs/env';
import { errorHandler } from './common/middlewares/error-handler.middleware';

const app = express();

// Middlewares bảo mật & Parse dữ liệu
app.use(helmet());

// 2. CẤU HÌNH CORS (CỰC KỲ QUAN TRỌNG CHO HTTP-ONLY COOKIE)
const whitelist = [env.CLIENT_URL]; // Lấy URL từ file env đã validate bằng Zod

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // BẮT BUỘC: Cho phép nhận và gửi Cookie giữa FE và BE
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })
);

// 3. Parse dữ liệu đầu vào
app.use(express.json()); // Đọc body JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Đọc Cookie từ Request Header

// Health Check Route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Viet Dynamic API is running 🚀' });
});

// TODO: Sau này sẽ import router tổng vào đây
// 4. Mount Routes (Sau này sẽ thêm vào đây)
// import router from '@/modules/router';
// app.use('/v1', router);

// global error handler
app.use(errorHandler);

export default app;
