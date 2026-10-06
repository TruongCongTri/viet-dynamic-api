import { Router } from 'express';
import { AdminMarketingController } from './admin-marketing.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken, requireRole } from '@/middlewares/auth.middleware';
import {
  createDiscountSchema,
  createVoucherSchema,
  giftVoucherSchema,
  toggleStatusSchema,
  paramIdSchema,
  attachCoursesToDiscountSchema,
} from './admin-marketing.schema';

export class AdminMarketingRoute {
  public router: Router;
  private readonly controller: AdminMarketingController;

  constructor() {
    this.router = Router();
    this.controller = new AdminMarketingController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(verifyToken, requireRole(['ADMIN']));

    // --- DISCOUNTS ---
    this.router.get('/discounts', this.controller.getDiscounts);
    this.router.post('/discounts', validate(createDiscountSchema), this.controller.createDiscount);
    this.router.get('/discounts/:id', validate(paramIdSchema), this.controller.getDiscountDetail);
    this.router.put(
      '/discounts/:id',
      validate(paramIdSchema),
      validate(createDiscountSchema),
      this.controller.updateDiscount
    );
    this.router.put(
      '/discounts/:id/courses',
      validate(paramIdSchema),
      validate(attachCoursesToDiscountSchema),
      this.controller.attachCoursesToDiscount
    );
    this.router.patch(
      '/discounts/:id/toggle',
      validate(paramIdSchema),
      validate(toggleStatusSchema),
      this.controller.toggleDiscountStatus
    );

    // --- VOUCHERS ---
    this.router.get('/vouchers', this.controller.getVouchers);
    this.router.post('/vouchers', validate(createVoucherSchema), this.controller.createVoucher);
    this.router.get('/vouchers/:id', validate(paramIdSchema), this.controller.getVoucherDetail);
    this.router.put(
      '/vouchers/:id',
      validate(paramIdSchema),
      validate(createVoucherSchema),
      this.controller.updateVoucher
    );
    this.router.post(
      '/vouchers/:id/gift',
      validate(paramIdSchema),
      validate(giftVoucherSchema),
      this.controller.giftVoucher
    );
    this.router.patch(
      '/vouchers/:id/toggle',
      validate(paramIdSchema),
      validate(toggleStatusSchema),
      this.controller.toggleVoucherStatus
    );
  }
}

export default new AdminMarketingRoute().router;
