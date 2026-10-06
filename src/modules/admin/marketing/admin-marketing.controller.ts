import { Request, Response } from 'express';
import { AdminMarketingService } from './admin-marketing.service';
import { successResponse } from '@/common/utils/responses/api-response';
import {
  CreateDiscountDTO,
  CreateVoucherDTO,
  AttachCoursesDTO,
  GiftVoucherDTO,
} from './admin-marketing.schema';

export class AdminMarketingController {
  private readonly adminMarketingService: AdminMarketingService;

  constructor() {
    this.adminMarketingService = new AdminMarketingService();
  }

  // ==========================================
  // [A] DISCOUNTS (KHUYẾN MÃI TỰ ĐỘNG)
  // ==========================================

  public getDiscounts = async (req: Request, res: Response) => {
    const query = req.query as Record<string, any>;

    const { data, meta } = await this.adminMarketingService.getDiscounts(query);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách khuyến mãi thành công',
      data,
      meta,
    });
  };

  public getDiscountDetail = async (req: Request, res: Response) => {
    const discountId = req.params.id as string;

    const result = await this.adminMarketingService.getDiscountDetail(discountId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy chi tiết khuyến mãi thành công',
      data: result,
    });
  };

  public createDiscount = async (req: Request, res: Response) => {
    const payload = req.body as CreateDiscountDTO;

    const result = await this.adminMarketingService.createDiscount(payload);
    successResponse(res, {
      statusCode: 201,
      message: 'Tạo chiến dịch khuyến mãi thành công',
      data: result,
    });
  };

  public updateDiscount = async (req: Request, res: Response) => {
    const discountId = req.params.id as string;
    const payload = req.body as Partial<CreateDiscountDTO>;

    const result = await this.adminMarketingService.updateDiscount(discountId, payload);
    successResponse(res, {
      statusCode: 200,
      message: 'Cập nhật chiến dịch thành công',
      data: result,
    });
  };

  public toggleDiscountStatus = async (req: Request, res: Response) => {
    const discountId = req.params.id as string;
    const { isActive } = req.body as { isActive: boolean };

    const result = await this.adminMarketingService.toggleDiscountStatus(discountId, isActive);
    successResponse(res, {
      statusCode: 200,
      message: isActive ? 'Đã BẬT chiến dịch' : 'Đã TẮT chiến dịch',
      data: result,
    });
  };

  public attachCoursesToDiscount = async (req: Request, res: Response) => {
    const discountId = req.params.id as string;
    const { courseIds } = req.body as AttachCoursesDTO;

    const result = await this.adminMarketingService.attachCoursesToDiscount(discountId, courseIds);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  // ==========================================
  // [B] VOUCHERS (MÃ GIẢM GIÁ)
  // ==========================================

  public getVouchers = async (req: Request, res: Response) => {
    const query = req.query as Record<string, any>;

    const { data, meta } = await this.adminMarketingService.getVouchers(query);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách mã giảm giá thành công',
      data,
      meta,
    });
  };

  public getVoucherDetail = async (req: Request, res: Response) => {
    const voucherId = req.params.id as string;

    const result = await this.adminMarketingService.getVoucherDetail(voucherId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy chi tiết mã giảm giá thành công',
      data: result,
    });
  };

  public createVoucher = async (req: Request, res: Response) => {
    const payload = req.body as CreateVoucherDTO;

    const result = await this.adminMarketingService.createVoucher(payload);
    successResponse(res, {
      statusCode: 201,
      message: 'Tạo mã giảm giá mới thành công',
      data: result,
    });
  };

  public updateVoucher = async (req: Request, res: Response) => {
    const voucherId = req.params.id as string;
    const payload = req.body as Partial<CreateVoucherDTO>;

    const result = await this.adminMarketingService.updateVoucher(voucherId, payload);
    successResponse(res, {
      statusCode: 200,
      message: 'Cập nhật cấu hình mã giảm giá thành công',
      data: result,
    });
  };

  public toggleVoucherStatus = async (req: Request, res: Response) => {
    const voucherId = req.params.id as string;
    const { isActive } = req.body as { isActive: boolean };

    const result = await this.adminMarketingService.toggleVoucherStatus(voucherId, isActive);
    successResponse(res, {
      statusCode: 200,
      message: isActive ? 'Đã MỞ KHÓA mã giảm giá' : 'Đã ĐÓNG BĂNG mã giảm giá',
      data: result,
    });
  };

  public giftVoucher = async (req: Request, res: Response) => {
    const voucherId = req.params.id as string;
    const { userIds } = req.body as GiftVoucherDTO;

    const result = await this.adminMarketingService.giftVoucher(voucherId, userIds);
    successResponse(res, { statusCode: 200, message: result.message });
  };
}
