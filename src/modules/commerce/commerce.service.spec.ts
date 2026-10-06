import { CommerceService } from './commerce.service';
import { CommerceRepository } from './commerce.repository';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// --- MOCKS ---
jest.mock('./commerce.repository');

// Mock cấu hình biến môi trường cho VNPAY
jest.mock('@/common/configs/env.config', () => ({
  env: {
    CLIENT_URL: 'http://localhost:3000',
    VNPAY_TMN_CODE: 'MOCK_TMN',
    VNPAY_HASH_SECRET: 'MOCK_SECRET',
    VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_RETURN_URL: 'http://localhost:3000/vnpay-return',
  },
}));

describe('CommerceService (Unit Tests - Full Coverage)', () => {
  let commerceService: CommerceService;
  let mockRepo: jest.Mocked<CommerceRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new CommerceRepository() as jest.Mocked<CommerceRepository>;
    commerceService = new CommerceService();
    (commerceService as any).commerceRepository = mockRepo;
  });

  // ==========================================
  // [A] WISHLIST (YÊU THÍCH)
  // ==========================================
  describe('Wishlist', () => {
    it('getWishlist should format and return wishlist items', async () => {
      mockRepo.getWishlist.mockResolvedValueOnce([
        { createdAt: new Date(), course: { id: 'c1', title: 'Course 1' } },
      ] as any);

      const result = await commerceService.getWishlist('u1');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Course 1');
      expect(result[0].addedAt).toBeDefined();
    });

    it('toggleWishlist should remove if already in wishlist', async () => {
      mockRepo.checkWishlistExists.mockResolvedValueOnce({} as any);
      mockRepo.removeFromWishlist.mockResolvedValueOnce({} as any);

      const result = await commerceService.toggleWishlist('u1', { courseId: 'c1' });
      expect(result.isAdded).toBe(false);
      expect(mockRepo.removeFromWishlist).toHaveBeenCalledWith('u1', 'c1');
    });

    it('toggleWishlist should add if not in wishlist', async () => {
      mockRepo.checkWishlistExists.mockResolvedValueOnce(null);
      mockRepo.addToWishlist.mockResolvedValueOnce({} as any);

      const result = await commerceService.toggleWishlist('u1', { courseId: 'c1' });
      expect(result.isAdded).toBe(true);
      expect(mockRepo.addToWishlist).toHaveBeenCalledWith('u1', 'c1');
    });

    it('clearWishlist should clear all items', async () => {
      mockRepo.clearWishlist.mockResolvedValueOnce({ count: 2 });
      const result = await commerceService.clearWishlist('u1');
      expect(result.message).toBeDefined();
    });
  });

  // ==========================================
  // [B] RECENTLY VIEWED (LỊCH SỬ XEM)
  // ==========================================
  describe('Recently Viewed', () => {
    it('getRecentlyViewed should return viewed history', async () => {
      mockRepo.getRecentlyViewed.mockResolvedValueOnce([
        { viewedAt: new Date(), course: { id: 'c1' } },
      ] as any);
      const result = await commerceService.getRecentlyViewed('u1');
      expect(result).toHaveLength(1);
    });

    it('trackRecentlyViewed should throw 404 if course slug does not exist', async () => {
      mockRepo.getCourseIdBySlug.mockResolvedValueOnce(null);
      await expect(commerceService.trackRecentlyViewed('u1', 'invalid-slug')).rejects.toMatchObject(
        { statusCode: 404 }
      );
    });

    it('trackRecentlyViewed should track course if exists', async () => {
      mockRepo.getCourseIdBySlug.mockResolvedValueOnce({ id: 'c1' } as any);
      mockRepo.trackRecentlyViewed.mockResolvedValueOnce({} as any);
      const result = await commerceService.trackRecentlyViewed('u1', 'valid-slug');
      expect(result.message).toBeDefined();
    });

    it('removeRecentlyViewedItem should fail gracefully (return message) if item not found', async () => {
      mockRepo.removeRecentlyViewedItem.mockRejectedValueOnce(new Error('Record not found'));
      const result = await commerceService.removeRecentlyViewedItem('u1', 'c1');
      expect(result.message).toBeDefined();
    });

    it('clearRecentlyViewed should remove all viewed history', async () => {
      mockRepo.clearRecentlyViewed.mockResolvedValueOnce({ count: 5 });
      const result = await commerceService.clearRecentlyViewed('u1');
      expect(result.message).toBeDefined();
    });
  });

  // ==========================================
  // [C] CART (GIỎ HÀNG) & MERGE
  // ==========================================
  describe('Cart Management', () => {
    it('getCart should auto clean owned items (Self-healing) and calculate total', async () => {
      mockRepo.getOrCreateCart.mockResolvedValueOnce({
        id: 'cart1',
        items: [{ id: 'item1', courseId: 'c1', createdAt: new Date(), course: { basePrice: 500 } }],
      } as any);

      // Giả lập user đã sở hữu 'c1'
      mockRepo.getUserOwnedCourseIds.mockResolvedValueOnce(['c1']);

      // Lần fetch thứ 2 sau khi dọn dẹp
      mockRepo.getOrCreateCart.mockResolvedValueOnce({
        id: 'cart1',
        items: [], // Đã bị xóa
      } as any);

      const cart = await commerceService.getCart('u1');
      expect(mockRepo.autoCleanOwnedItemsFromCart).toHaveBeenCalledWith('cart1', ['c1']);
      expect(cart.totalItems).toBe(0);
      expect(cart.totalPrice).toBe(0);
    });

    it('addToCart should throw 400 if user already owns the course', async () => {
      mockRepo.checkEnrollmentExists.mockResolvedValueOnce({ id: 'enr1' } as any);
      await expect(commerceService.addToCart('u1', { courseId: 'c1' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('addToCart should return message if course already in cart', async () => {
      mockRepo.checkEnrollmentExists.mockResolvedValueOnce(null);
      mockRepo.getOrCreateCart.mockResolvedValueOnce({ id: 'cart1' } as any);
      mockRepo.checkCartItemExists.mockResolvedValueOnce({ id: 'item1' } as any);

      const result = await commerceService.addToCart('u1', { courseId: 'c1' });
      expect(result.message).toContain('đã có');
    });

    it('addToCart should add course to cart successfully', async () => {
      mockRepo.checkEnrollmentExists.mockResolvedValueOnce(null);
      mockRepo.getOrCreateCart.mockResolvedValueOnce({ id: 'cart1' } as any);
      mockRepo.checkCartItemExists.mockResolvedValueOnce(null);
      mockRepo.addCartItem.mockResolvedValueOnce({} as any);

      const result = await commerceService.addToCart('u1', { courseId: 'c1' });
      expect(mockRepo.addCartItem).toHaveBeenCalledWith('cart1', 'c1');
      expect(result.message).toContain('thành công');
    });

    it('removeCartItem should fail gracefully', async () => {
      mockRepo.getOrCreateCart.mockResolvedValueOnce({ id: 'cart1' } as any);
      mockRepo.removeCartItem.mockRejectedValueOnce(new Error('Record not found'));
      const result = await commerceService.removeCartItem('u1', 'c1');
      expect(result.message).toBeDefined();
    });

    it('clearCart should clear cart items', async () => {
      mockRepo.getOrCreateCart.mockResolvedValueOnce({ id: 'cart1' } as any);
      mockRepo.clearCart.mockResolvedValueOnce({ count: 1 });
      const result = await commerceService.clearCart('u1');
      expect(result.message).toBeDefined();
    });

    it('moveCartItemToWishlist should remove from cart and add to wishlist', async () => {
      mockRepo.getOrCreateCart.mockResolvedValueOnce({ id: 'cart1' } as any);
      mockRepo.removeCartItem.mockResolvedValueOnce({} as any);
      mockRepo.checkWishlistExists.mockResolvedValueOnce(null);
      mockRepo.addToWishlist.mockResolvedValueOnce({} as any);

      const result = await commerceService.moveCartItemToWishlist('u1', 'c1');
      expect(mockRepo.addToWishlist).toHaveBeenCalledWith('u1', 'c1');
      expect(result.message).toBeDefined();
    });

    it('mergeGuestCart should filter owned items and add valid ones', async () => {
      // Giả sử guest gửi lên [c1, c2]. User đã có sẵn [c1].
      mockRepo.getUserOwnedCourseIds.mockResolvedValueOnce(['c1']);
      mockRepo.getOrCreateCart.mockResolvedValueOnce({ id: 'cart1', items: [] } as any);
      mockRepo.addManyCartItems.mockResolvedValueOnce({ count: 1 }); // Chỉ merge c2

      // Mock hàm getCart gọi ở cuối
      jest.spyOn(commerceService, 'getCart').mockResolvedValueOnce({ totalItems: 1 } as any);

      const result = await commerceService.mergeGuestCart('u1', { courseIds: ['c1', 'c2'] });
      expect(mockRepo.addManyCartItems).toHaveBeenCalledWith('cart1', ['c2']); // c1 bị gạt bỏ
      expect(result.totalItems).toBe(1);
    });
  });

  // ==========================================
  // [D] VOUCHER & TOÁN HỌC (DECIMAL)
  // ==========================================
  describe('Voucher Management & Application', () => {
    it('saveVoucher should throw 404 if not found', async () => {
      mockRepo.getVoucherByCode.mockResolvedValueOnce(null);
      await expect(commerceService.saveVoucher('u1', 'CODE')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('saveVoucher should throw 400 if voucher is exhausted', async () => {
      mockRepo.getVoucherByCode.mockResolvedValueOnce({
        isActive: true,
        startDate: new Date(Date.now() - 10000),
        maxUsesTotal: 10,
        currentUses: 10, // Đã hết lượt
      } as any);
      await expect(commerceService.saveVoucher('u1', 'CODE')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('saveVoucher should throw 403 if audience is not GLOBAL', async () => {
      mockRepo.getVoucherByCode.mockResolvedValueOnce({
        isActive: true,
        startDate: new Date(Date.now() - 10000),
        maxUsesTotal: 10,
        currentUses: 1,
        audience: 'PRIVATE', // Mã riêng tư
      } as any);
      await expect(commerceService.saveVoucher('u1', 'CODE')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('applyVoucher should throw 400 if cart is empty', async () => {
      jest.spyOn(commerceService, 'getCart').mockResolvedValueOnce({ totalItems: 0 } as any);
      await expect(commerceService.applyVoucher('u1', { voucherId: 'v1' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('applyVoucher should prevent negative finalPrice and cap discountAmount (FIXED_AMOUNT)', async () => {
      // Giỏ hàng 100k
      jest
        .spyOn(commerceService, 'getCart')
        .mockResolvedValueOnce({ totalItems: 1, totalPrice: 100000, cartId: 'cart1', items: [] });
      mockRepo.checkUserVoucherExists.mockResolvedValueOnce({ isUsed: false } as any);

      // Voucher giảm cứng 150k (Lớn hơn giá trị giỏ hàng)
      mockRepo.getVoucherById.mockResolvedValueOnce({
        id: 'v1',
        isActive: true,
        startDate: new Date(Date.now() - 10000),
        expiresAt: new Date(Date.now() + 100000),
        maxUsesTotal: null,
        type: 'FIXED_AMOUNT',
        value: 150000,
        minOrderValue: 0,
      } as any);

      const res = await commerceService.applyVoucher('u1', { voucherId: 'v1' });

      // Final price không được âm, Discount chỉ được tối đa bằng giá trị giỏ hàng
      expect(res.finalPrice).toBe(0);
      expect(res.discountAmount).toBe(100000);
    });

    it('applyVoucher should apply PERCENTAGE logic with maxDiscountAmount', async () => {
      jest
        .spyOn(commerceService, 'getCart')
        .mockResolvedValueOnce({ totalItems: 1, totalPrice: 200000, cartId: 'cart1', items: [] });
      mockRepo.checkUserVoucherExists.mockResolvedValueOnce({ isUsed: false } as any);

      // Voucher giảm 50%, nhưng tối đa chỉ giảm 50k
      mockRepo.getVoucherById.mockResolvedValueOnce({
        id: 'v1',
        isActive: true,
        startDate: new Date(Date.now() - 10000),
        expiresAt: null,
        type: 'PERCENTAGE',
        value: 50,
        maxDiscountAmount: 50000,
        minOrderValue: 0,
      } as any);

      const res = await commerceService.applyVoucher('u1', { voucherId: 'v1' });

      // 50% của 200k là 100k, nhưng bị cap ở 50k
      expect(res.discountAmount).toBe(50000);
      expect(res.finalPrice).toBe(150000);
    });
  });

  // ==========================================
  // [E] CHECKOUT & TRANSACTION
  // ==========================================
  describe('Checkout Logic', () => {
    it('checkout should throw 400 if there is an existing PENDING order with same courses', async () => {
      jest.spyOn(commerceService, 'getCart').mockResolvedValueOnce({
        totalItems: 1,
        totalPrice: 100000,
        cartId: 'cart1',
        items: [{ course: { id: 'c1' } }],
      } as any);
      mockRepo.checkPendingOrderForCourses.mockResolvedValueOnce({ id: 'order1' } as any); // Bị kẹt đơn PENDING

      await expect(commerceService.checkout('u1', { voucherId: 'v1' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('checkout should throw 409 on VOUCHER_RACE_CONDITION', async () => {
      jest.spyOn(commerceService, 'getCart').mockResolvedValueOnce({
        totalItems: 1,
        totalPrice: 100000,
        cartId: 'cart1',
        items: [{ course: { id: 'c1' } }],
      } as any);
      mockRepo.checkPendingOrderForCourses.mockResolvedValueOnce(null);
      jest
        .spyOn(commerceService, 'applyVoucher')
        .mockResolvedValueOnce({ finalPrice: 80000 } as any);
      mockRepo.getVoucherById.mockResolvedValueOnce({ version: 1 } as any);

      // Repository báo lỗi Race Condition
      mockRepo.createOrderTransaction.mockRejectedValueOnce(new Error('VOUCHER_RACE_CONDITION'));

      await expect(commerceService.checkout('u1', { voucherId: 'v1' })).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('checkout should execute Transaction successfully and return Order ID', async () => {
      jest.spyOn(commerceService, 'getCart').mockResolvedValueOnce({
        totalItems: 1,
        totalPrice: 100000,
        cartId: 'cart1',
        items: [{ course: { id: 'c1' } }],
      } as any);
      mockRepo.checkPendingOrderForCourses.mockResolvedValueOnce(null);

      jest
        .spyOn(commerceService, 'applyVoucher')
        .mockResolvedValueOnce({ finalPrice: 80000 } as any);
      mockRepo.getVoucherById.mockResolvedValueOnce({ version: 1 } as any);
      mockRepo.createOrderTransaction.mockResolvedValueOnce({
        id: 'order-123',
        totalAmount: 80000,
      } as any);

      const res = await commerceService.checkout('u1', { voucherId: 'v1' });

      expect(mockRepo.createOrderTransaction).toHaveBeenCalledWith(
        'u1',
        'cart1',
        expect.any(Array),
        80000,
        'v1',
        1
      );
      expect(res.orderId).toBe('order-123');
    });
  });

  // ==========================================
  // [F] VNPAY & POLLING
  // ==========================================
  describe('Payments & Polling', () => {
    it('createPaymentUrl should bypass gateway for 0 VND orders', async () => {
      mockRepo.getOrderById.mockResolvedValueOnce({
        id: 'order1',
        status: 'PENDING',
        totalAmount: 0,
      } as any);
      mockRepo.markOrderAsSuccessFreeOfCharge.mockResolvedValueOnce({} as any);

      const res = await commerceService.createPaymentUrl('u1', 'order1', 'VNPAY', '127.0.0.1');

      expect(mockRepo.markOrderAsSuccessFreeOfCharge).toHaveBeenCalledWith('order1', 'u1');
      expect(res.paymentUrl).toContain('/checkout/success?orderId=order1');
    });

    it('createPaymentUrl should generate valid VNPAY url for non-zero orders', async () => {
      mockRepo.getOrderById.mockResolvedValueOnce({
        id: 'order1',
        status: 'PENDING',
        totalAmount: 100000,
      } as any);
      mockRepo.createPaymentAttempt.mockResolvedValueOnce({ id: 'txn1', amount: 100000 } as any);

      const res = await commerceService.createPaymentUrl('u1', 'order1', 'VNPAY', '127.0.0.1');

      expect(res.paymentUrl).toContain('https://sandbox.vnpayment.vn');
      expect(res.paymentUrl).toContain('vnp_SecureHash=');
    });

    it('pollOrderStatus should return order status', async () => {
      mockRepo.getOrderStatus.mockResolvedValueOnce({ status: 'SUCCESS' } as any);
      const res = await commerceService.pollOrderStatus('u1', 'o1');
      expect(res.status).toBe('SUCCESS');
    });
  });
});
