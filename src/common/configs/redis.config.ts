import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.config';

// BullMQ requires maxRetriesPerRequest to be null
const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  // Optional: Add family: 0 if you run into IPv6 resolution issues with Upstash
  family: 0,
};

// Use Upstash REDIS_URL if available (handles TLS automatically via 'rediss://')
// Fallback to local host/port for local development
// export const redisConnection = env.REDIS_URL
//   ? new Redis(env.REDIS_URL, redisOptions)
//   : new Redis({
//       host: env.REDIS_HOST || '127.0.0.1',
//       port: Number(env.REDIS_PORT) || 6379,
//       ...redisOptions,
//     });
export const redisConnection = new Redis({
  host: env.REDIS_HOST || '127.0.0.1',
  port: Number(env.REDIS_PORT) || 6379,
  ...redisOptions,
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err);
});

redisConnection.once('ready', () => {
  console.log('✅ Redis Connected successfully.');
});
