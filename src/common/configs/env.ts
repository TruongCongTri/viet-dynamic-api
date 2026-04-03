import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().min(1, 'Vui lòng cấu hình DATABASE_URL'),
  CLIENT_URL: z.string().min(1, 'Vui lòng cấu hình CLIENT_URL'),

  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('15m'), // Mặc định là 15 phút
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'), // Mặc định là 7 ngày

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(1).default(10), // Tự động ép kiểu sang số!

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().min(1, 'Vui lòng cấu hình SMTP_USER'),
  SMTP_PASSWORD: z.string().min(8, 'Vui lòng cấu hình SMTP_PASSWORD'),

  // URL cho dịch vụ SMS (eSMS)
  ESMS_URL: z
    .string()
    .default('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_get'),
  ESMS_API_KEY: z.string().optional(),
  ESMS_SECRET_KEY: z.string().optional(),

  // URL cho dịch vụ Zalo ZNS
  ZALO_ZNS_URL: z.string().default('https://business.openapi.zalo.me/message/template'),
  ZALO_APP_ID: z.string().optional(),
  ZALO_APP_SECRET: z.string().optional(),
  ZALO_PAGE_ID: z.string().optional(),
  ZALO_ACCESS_TOKEN: z.string().optional(),
  ZALO_OTP_TEMPLATE_ID: z.string().optional(),
});

const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ LỖI BIẾN MÔI TRƯỜNG BACKEND:');
  console.error(envParsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = envParsed.data;
