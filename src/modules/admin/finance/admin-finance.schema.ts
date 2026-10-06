import { z } from 'zod';

export const queryOrdersSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
    paymentProvider: z.enum(['VNPAY', 'MOMO']).optional(),
    search: z.string().optional(), // Tìm theo email học viên
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  }),
});

export const refundOrderSchema = z.object({
  body: z.object({
    reason: z.string().min(5, { message: 'Vui lòng nhập lý do hoàn tiền' }),
  }),
});

export const financeChartSchema = z.object({
  query: z.object({
    timeframe: z.enum(['7d', '30d', '12m']).default('30d'),
  }),
});

export const paramIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']),
  }),
});

export type QueryOrdersDTO = z.infer<typeof queryOrdersSchema>['query'];
export type RefundOrderDTO = z.infer<typeof refundOrderSchema>['body'];
export type FinanceChartDTO = z.infer<typeof financeChartSchema>['query'];

export type UpdateOrderStatusDTO = z.infer<typeof updateOrderStatusSchema>['body'];
