import { Request, Response } from 'express';
import { CommerceService } from './commerce.service';
import { successResponse } from '@/common/utils/responses/api-response';
import {
  ApplyVoucherDTO,
  CartItemDTO,
  CheckoutDTO,
  CreatePaymentUrlDTO,
  MergeGuestCartDTO,
  ToggleWishlistDTO,
} from './commerce.schema';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';

export class CommerceController {
  private readonly commerceService: CommerceService;

  constructor() {
    this.commerceService = new CommerceService();
  }

  // ==========================================
  // [A] WISHLIST (YÊU THÍCH)
  // ==========================================

  public getWishlist = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const result = await this.commerceService.getWishlist(userId);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED_ALL(RESOURCES.WISHLIST),
      data: result,
    });
  };

  public toggleWishlist = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const data = req.body as ToggleWishlistDTO;
    const result = await this.commerceService.toggleWishlist(userId, data);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
      data: { isAdded: result.isAdded },
    });
  };

  public clearWishlist = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const result = await this.commerceService.clearWishlist(userId);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
    });
  };

  // ==========================================
  // [B] RECENTLY VIEWED (LỊCH SỬ XEM)
  // ==========================================

  public getRecentlyViewed = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const result = await this.commerceService.getRecentlyViewed(userId);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED_ALL(RESOURCES.RECENT_VIEWED),
      data: result,
    });
  };

  public trackRecentlyViewed = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const slug = req.params.slug as string;

    await this.commerceService.trackRecentlyViewed(userId, slug);

    // Đây là Silent API (gọi ngầm), không cần trả data phức tạp
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.ACTIVITY.SUCCESS.SAVED(
        RESOURCES.RECENT_VIEWED,
        RESOURCES.RECENT_VIEWED_LIST
      ),
    });
  };

  public removeRecentlyViewedItem = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const courseId = req.params.courseId as string;

    const result = await this.commerceService.removeRecentlyViewedItem(userId, courseId);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
    });
  };

  public clearRecentlyViewed = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const result = await this.commerceService.clearRecentlyViewed(userId);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
    });
  };

  // ==========================================
  // [C] CART (GIỎ HÀNG)
  // ==========================================

  public getCart = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.getCart(userId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.CART),
      data: result,
    });
  };

  public addToCart = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.addToCart(userId, req.body as CartItemDTO);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public removeCartItem = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = req.params.courseId as string;
    const result = await this.commerceService.removeCartItem(userId, courseId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public clearCart = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.clearCart(userId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public moveCartItemToWishlist = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = req.params.courseId as string;
    const result = await this.commerceService.moveCartItemToWishlist(userId, courseId);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public mergeGuestCart = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.mergeGuestCart(userId, req.body as MergeGuestCartDTO);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.CART.SUCCESS.SYNC,
      data: result, // Trả về giỏ hàng mới nhất để FE cập nhật Zustand
    });
  };

  // ==========================================
  // [D] VOUCHER (MÃ GIẢM GIÁ)
  // ==========================================

  public getMyVouchers = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.getMyVouchers(userId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED_ALL(RESOURCES.VOUCHER),
      data: result,
    });
  };

  public saveVoucher = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const code = req.params.code as string;
    const result = await this.commerceService.saveVoucher(userId, code);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public getApplicableVouchers = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.getApplicableVouchers(userId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.VOUCHER.SUCCESS.FETCHED_ALL_AVAILABLE,
      data: result,
    });
  };

  public applyVoucher = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.applyVoucher(userId, req.body as ApplyVoucherDTO);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.VOUCHER.SUCCESS.APPLIED,
      data: result,
    });
  };

  // ==========================================
  // [E] CHECKOUT & PAYMENTS
  // ==========================================

  public checkout = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.checkout(userId, req.body as CheckoutDTO);
    successResponse(res, { statusCode: 201, message: result.message, data: result });
  };

  public createPaymentUrl = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const orderId = req.params.id as string;
    const { provider } = req.body as CreatePaymentUrlDTO;

    // Lấy IP thật của khách hàng (Cần thiết cho VNPAY)
    const forwardedIps = req.headers['x-forwarded-for'];
    const socketIp = req.socket.remoteAddress;
    const ipAddr = forwardedIps || socketIp || '127.0.0.1';
    const cleanIp = Array.isArray(ipAddr)
      ? (ipAddr[0] || '127.0.0.1').trim()
      : typeof ipAddr === 'string'
        ? (ipAddr.split(',')[0] || '127.0.0.1').trim()
        : '127.0.0.1';

    const result = await this.commerceService.createPaymentUrl(userId, orderId, provider, cleanIp);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.ORDER.SUCCESS.CREATED_PAYMENT_URL,
      data: result,
    });
  };

  // ==========================================
  // [F] ORDER HISTORY & POLLING
  // ==========================================

  public getMyOrders = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.commerceService.getMyOrders(userId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED_ALL(RESOURCES.ORDER_LIST),
      data: result,
    });
  };

  public getOrderDetails = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const orderId = req.params.id as string;
    const result = await this.commerceService.getOrderDetails(userId, orderId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.ORDER),
      data: result,
    });
  };

  public pollOrderStatus = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const orderId = req.params.id as string;
    const result = await this.commerceService.pollOrderStatus(userId, orderId);
    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.ORDER.SUCCESS.POLLING,
      data: result,
    });
  };
}
