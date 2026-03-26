import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('15m'), // Mặc định là 15 phút
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'), // Mặc định là 7 ngày
  BCRYPT_SALT: z.coerce.number().int().min(1).default(10), // Tự động ép kiểu sang số!
});

const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ LỖI BIẾN MÔI TRƯỜNG BACKEND:');
  console.error(envParsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = envParsed.data;
