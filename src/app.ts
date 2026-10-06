/**
 * @file app.ts
 * @description Core Express application configuration.
 * Sets up security headers, CORS policies, request parsers, and global error handling.
 * @module App
 */
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from '@/common/configs/env.config';
import { errorHandler } from './middlewares/error-handler.middleware';
import { API_VERSION } from './constants/endpoints';
import v1Router from './routes/v1';

const app = express();

/**
 * --- PROXY CONFIGURATION ---
 * Required for correct IP tracking and cookie security when behind
 * load balancers or platforms like Heroku/Vercel.
 */
app.set('trust proxy', 1);

/**
 * --- SECURITY MIDDLEWARE ---
 * Helmet: Sets secure HTTP headers to protect against common web vulnerabilities.
 * CORS: Restricts cross-origin requests to the validated CLIENT_URL.
 */
app.use(helmet());

const whitelist = env.CLIENT_URL.split(',');

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies to be sent in CORS requests
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })
);

/**
 * --- REQUEST PARSING ---
 */
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
); // Đọc body JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Đọc Cookie từ Request Header

// Health Check Route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Viet Dynamic API is running 🚀' });
});

// TODO: Sau này sẽ import router tổng vào đây
/**
 * --- API ROUTES ---
 */
// TẠM THỜI DÁN VÀO ĐỂ DEBUG JEST
app.use((req, _res, next) => {
  if (req.url.includes('register')) {
    console.log('🕵️ JEST ĐANG GỌI URL:', req.originalUrl);
    console.log('🕵️ BODY NHẬN ĐƯỢC:', req.body);
  }
  next();
});
app.use(API_VERSION, v1Router);

/**
 * --- ERROR HANDLING ---
 * Must be mounted last to catch all errors bubbled up from routes and controllers.
 */
app.use(errorHandler);

export default app;
