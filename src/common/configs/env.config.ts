/**
 * @file env.ts
 * @description Centralized environment variable management.
 * Uses Zod to enforce type-safety and presence of required variables at runtime.
 */
import { z } from 'zod';
import dotenv from 'dotenv';
import { APP_CONFIG } from '@/constants/app.constant';
import { FIELDS } from '@/constants/fields';
import { MESSAGES } from '@/constants/messages';
import path from 'path';

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const envSchema = z.object({
  NODE_ENV: z.string().default(APP_CONFIG.ENV.DEVELOPMENT),
  PORT: z.string().default(APP_CONFIG.SERVER.DEFAULT_PORT),
  DATABASE_URL: z.string().min(1, 'Vui lòng cấu hình DATABASE_URL'),
  CLIENT_URL: z.string().min(1, 'Vui lòng cấu hình CLIENT_URL'),

  REDIS_HOST: z.string().min(1, MESSAGES.SERVER.CONFIGURE(FIELDS.REDIS_HOST)),
  REDIS_PORT: z.string().default('6379'),
  REDIS_URL: z.string().min(1, MESSAGES.SERVER.CONFIGURE(FIELDS.REDIS_URL)),

  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('15m'), // Mặc định là 15 phút
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'), // Mặc định là 7 ngày

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(1).default(10), // Tự động ép kiểu sang số!
  CORS_ORIGIN: z.string().default('*'),

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

  // Cấu hình cho VNPAY
  VNPAY_URL: z.string().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNPAY_RETURN_URL: z.string().default('http://localhost:3000/payment-result'),
  VNPAY_TMN_CODE: z.string().optional(),
  VNPAY_HASH_SECRET: z.string().optional(),
  VNPAY_API_URL: z.string().optional(),

  // Cấu hình cho Momo
  MOMO_URL: z.string().default('https://test-payment.momo.vn/gw_payment/transactionProcessor'),
  MOMO_PARTNER_CODE: z.string().optional(),
  MOMO_ACCESS_KEY: z.string().optional(),
  MOMO_SECRET_KEY: z.string().optional(),
  MOMO_RETURN_URL: z.string().default('http://localhost:3000/payment-result'),

  // AWS_REGION: z.string().default('ap-southeast-1'),
  // AWS_ACCESS_KEY_ID: z.string().optional(),
  // AWS_SECRET_ACCESS_KEY: z.string().optional(),
  // AWS_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_WEBHOOK_SECRET: z.string().optional(),
});

/**
 * Perform safe parsing of process.env.
 * If validation fails, it triggers an immediate process exit to prevent unstable runtime states.
 */
const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ LỖI BIẾN MÔI TRƯỜNG BACKEND:');
  console.error(envParsed.error.flatten().fieldErrors);
  process.exit(1);
}

/**
 * @exports env
 * @description Immutable, validated environment configuration object.
 */
export const env = envParsed.data;
