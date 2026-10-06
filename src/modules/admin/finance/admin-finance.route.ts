import { Router } from 'express';
import { AdminFinanceController } from './admin-finance.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken, requireRole } from '@/middlewares/auth.middleware';
import {
  paramIdSchema,
  queryOrdersSchema,
  refundOrderSchema,
  updateOrderStatusSchema,
} from './admin-finance.schema';

export class AdminFinanceRoute {
  public router: Router;
  private readonly controller: AdminFinanceController;

  constructor() {
    this.router = Router();
    this.controller = new AdminFinanceController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Đảm bảo chỉ ADMIN (hoặc ROLE có liên quan tới Kế toán) mới được truy cập [cite: 800]
    this.router.use(verifyToken, requireRole(['ADMIN']));

    this.router.get('/overview', this.controller.getFinanceOverview);
    this.router.get('/orders/course-revenue', this.controller.getCourseRevenueStats);

    // --- ORDERS & PAYMENTS ---
    this.router.get('/orders', validate(queryOrdersSchema), this.controller.getOrders);
    this.router.post('/orders/cleanup-trash', this.controller.cleanupTrashOrders);

    this.router.get('/orders/:id', validate(paramIdSchema), this.controller.getOrderDetail);
    this.router.post(
      '/orders/:id/query-payment-status',
      validate(paramIdSchema),
      this.controller.queryPaymentStatus
    );
    this.router.post(
      '/orders/:id/refund',
      validate(paramIdSchema),
      validate(refundOrderSchema),
      this.controller.refundOrder
    );

    this.router.get('/payments/:id', validate(paramIdSchema), this.controller.getPaymentPayload);

    // --- ANALYTICS ---

    this.router.put(
      '/orders/:id/status',
      validate(paramIdSchema),
      validate(updateOrderStatusSchema),
      this.controller.updateOrderStatusManual
    );
  }
}

export default new AdminFinanceRoute().router;
