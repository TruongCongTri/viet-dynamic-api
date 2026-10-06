import { Router } from 'express';
import { CommerceController } from './commerce.controller';
import { ENDPOINTS } from '@/constants/endpoints';
import { validate } from '@/middlewares/validate.middleware';
import {
  applyVoucherSchema,
  cartItemParamSchema,
  cartItemSchema,
  checkoutSchema,
  createPaymentUrlSchema,
  deleteRecentlyViewedItemSchema,
  mergeGuestCartSchema,
  orderParamSchema,
  saveVoucherParamSchema,
  toggleWishlistSchema,
  trackRecentlyViewedSchema,
} from './commerce.schema';
import { verifyToken } from '@/middlewares/auth.middleware';

export class CommerceRoute {
  public router: Router;
  private readonly commerceController: CommerceController;

  constructor(controller?: CommerceController) {
    this.router = Router();
    this.commerceController = controller || new CommerceController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // TẤT CẢ CÁC API COMMERCE ĐỀU BẮT BUỘC ĐĂNG NHẬP
    this.router.use(verifyToken);

    // ==========================================
    // [A] WISHLIST (YÊU THÍCH)
    // ==========================================

    // Lấy danh sách Wishlist
    this.router.get(
      ENDPOINTS.COMMERCE.WISHLIST, // /courses/wishlist
      this.commerceController.getWishlist
    );

    // Xóa sạch Wishlist
    this.router.delete(
      ENDPOINTS.COMMERCE.WISHLIST, // /courses/wishlist
      this.commerceController.clearWishlist
    );

    // Lật trạng thái (Thêm/Xóa)
    this.router.post(
      ENDPOINTS.COMMERCE.WISHLIST_TOGGLE, // /courses/wishlist/toggle
      validate(toggleWishlistSchema),
      this.commerceController.toggleWishlist
    );

    // ==========================================
    // [B] RECENTLY VIEWED (LỊCH SỬ XEM)
    // ==========================================

    // Lấy danh sách khóa học vừa xem
    this.router.get(
      ENDPOINTS.COMMERCE.RECENTLY_VIEWED, // /commerce/recently-viewed
      this.commerceController.getRecentlyViewed
    );

    // Xóa 1 khóa học khỏi lịch sử xem
    this.router.delete(
      ENDPOINTS.COMMERCE.RECENTLY_VIEWED_REMOVE, // /courses/recently-viewed/:courseId
      validate(deleteRecentlyViewedItemSchema),
      this.commerceController.removeRecentlyViewedItem
    );

    // Xóa sạch lịch sử xem (Privacy)
    this.router.delete(
      ENDPOINTS.COMMERCE.RECENTLY_VIEWED, // /courses/recently-viewed
      this.commerceController.clearRecentlyViewed
    );

    // Ghi nhận lịch sử xem (Silent API gọi ngầm khi vào trang chi tiết)
    this.router.post(
      ENDPOINTS.COMMERCE.RECENTLY_VIEWED_TRACK, // /courses/:slug/view
      validate(trackRecentlyViewedSchema),
      this.commerceController.trackRecentlyViewed
    );

    // ==========================================
    // [C] CART (GIỎ HÀNG)
    // ==========================================

    this.router.get(
      ENDPOINTS.COMMERCE.CART, // /cart
      this.commerceController.getCart
    );

    this.router.post(
      ENDPOINTS.COMMERCE.CART_ITEMS, // /cart/items
      validate(cartItemSchema),
      this.commerceController.addToCart
    );

    this.router.delete(
      ENDPOINTS.COMMERCE.CART_ITEMS_REMOVE, // /cart/items/:courseId
      validate(cartItemParamSchema),
      this.commerceController.removeCartItem
    );

    this.router.delete(
      ENDPOINTS.COMMERCE.CART, // /cart
      this.commerceController.clearCart
    );

    this.router.post(
      ENDPOINTS.COMMERCE.CART_ITEMS_MOVE_TO_WISHLIST, // /cart/items/:courseId/move-to-wishlist
      validate(cartItemParamSchema),
      this.commerceController.moveCartItemToWishlist
    );

    // Gộp giỏ hàng (Sau khi Login)
    this.router.post(
      ENDPOINTS.COMMERCE.MERGE_GUEST_CART, // /cart/merge-guest-cart
      validate(mergeGuestCartSchema),
      this.commerceController.mergeGuestCart
    );

    // ==========================================
    // [D] VOUCHER (MÃ GIẢM GIÁ)
    // ==========================================

    // Lấy ví voucher của tôi
    this.router.get(
      ENDPOINTS.COMMERCE.VOUCHERS_ME, // /vouchers/me
      this.commerceController.getMyVouchers
    );

    // Lấy gợi ý mã có thể áp dụng cho giỏ hàng hiện tại
    this.router.get(
      ENDPOINTS.COMMERCE.VOUCHERS_APPLICABLE, // /vouchers/applicable
      this.commerceController.getApplicableVouchers
    );

    // Áp dụng tính toán giá
    this.router.post(
      ENDPOINTS.COMMERCE.VOUCHERS_APPLY, // /vouchers/apply
      validate(applyVoucherSchema),
      this.commerceController.applyVoucher
    );

    // Lưu mã giảm giá
    this.router.post(
      ENDPOINTS.COMMERCE.VOUCHERS_SAVE, // /vouchers/:code/save
      validate(saveVoucherParamSchema),
      this.commerceController.saveVoucher
    );

    // ==========================================
    // [E] CHECKOUT & PAYMENTS
    // ==========================================

    // Chốt đơn
    this.router.post(
      ENDPOINTS.COMMERCE.ORDERS_CHECKOUT, // /orders/checkout
      validate(checkoutSchema),
      this.commerceController.checkout
    );

    // Tạo link thanh toán
    this.router.post(
      ENDPOINTS.COMMERCE.ORDERS_PAY, // /orders/:id/pay
      validate(createPaymentUrlSchema),
      this.commerceController.createPaymentUrl
    );

    // ==========================================
    // [F] ORDER HISTORY & POLLING
    // ==========================================

    // Lấy lịch sử tất cả đơn hàng
    this.router.get(
      ENDPOINTS.COMMERCE.ORDERS, // /orders
      this.commerceController.getMyOrders
    );

    // Polling trạng thái (Thường để trước route có :id để tránh bị đè logic)
    this.router.get(
      ENDPOINTS.COMMERCE.ORDER_STATUS, // /orders/:id/status-polling
      validate(orderParamSchema),
      this.commerceController.pollOrderStatus
    );

    // Lấy chi tiết đơn hàng
    this.router.get(
      ENDPOINTS.COMMERCE.ORDERS_DETAIL, // /orders/:id
      validate(orderParamSchema),
      this.commerceController.getOrderDetails
    );
  }
}

export default new CommerceRoute().router;
