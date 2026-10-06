import { CommerceRepository } from './commerce.repository';
import {
  ApplyVoucherDTO,
  CartItemDTO,
  CheckoutDTO,
  MergeGuestCartDTO,
  ToggleWishlistDTO,
} from './commerce.schema';
import { AppError } from '@/common/errors/app.error';
import { MESSAGES } from '@/constants/messages';
import { ERROR_CODES } from '@/constants/error-codes';
import { RESOURCES } from '@/constants/resources';
import { Decimal } from 'decimal.js';
import { env } from '@/common/configs/env.config';

import moment from 'moment-timezone'; // Bắt buộc cho VNPAY
import crypto from 'crypto';
import querystring from 'qs'; // Dùng qs chuẩn hơn URLSearchParams cho VNPAY

export class CommerceService {
  private readonly commerceRepository: CommerceRepository;

  constructor() {
    this.commerceRepository = new CommerceRepository();
  }

  // ==========================================
  // [A] WISHLIST (YÊU THÍCH)
  // ==========================================

  public async getWishlist(userId: string) {
    const wishlist = await this.commerceRepository.getWishlist(userId);
    // Làm phẳng data để FE dễ map UI
    return wishlist.map((item) => ({
      addedAt: item.createdAt,
      ...item.course,
    }));
  }

  public async toggleWishlist(userId: string, data: ToggleWishlistDTO) {
    const { courseId } = data;

    // Logic "Lật" (Toggle)
    const existingItem = await this.commerceRepository.checkWishlistExists(userId, courseId);

    if (existingItem) {
      await this.commerceRepository.removeFromWishlist(userId, courseId);
      return {
        isAdded: false,
        message: MESSAGES.ACTIVITY.SUCCESS.REMOVED(RESOURCES.COURSE, RESOURCES.WISHLIST_LIST),
      };
    } else {
      await this.commerceRepository.addToWishlist(userId, courseId);
      return {
        isAdded: true,
        message: MESSAGES.ACTIVITY.SUCCESS.ADDED(RESOURCES.COURSE, RESOURCES.WISHLIST_LIST),
      };
    }
  }

  public async clearWishlist(userId: string) {
    await this.commerceRepository.clearWishlist(userId);
    return { message: MESSAGES.ACTIVITY.SUCCESS.CLEARED(RESOURCES.WISHLIST_LIST) };
  }

  // ==========================================
  // [B] RECENTLY VIEWED (LỊCH SỬ XEM)
  // ==========================================

  public async getRecentlyViewed(userId: string) {
    const history = await this.commerceRepository.getRecentlyViewed(userId);
    return history.map((item) => ({
      viewedAt: item.viewedAt,
      ...item.course,
    }));
  }

  public async trackRecentlyViewed(userId: string, slug: string) {
    // Silent API: Lấy ID từ Slug trước khi lưu lịch sử
    const course = await this.commerceRepository.getCourseIdBySlug(slug);
    if (!course) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.COURSE),
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );
    }

    await this.commerceRepository.trackRecentlyViewed(userId, course.id);
    return { message: MESSAGES.VIEW.SUCCESS.TRACKED };
  }

  public async removeRecentlyViewedItem(userId: string, courseId: string) {
    // Dùng try-catch bọc lại để nếu user bấm xóa liên tục khóa đã xóa rồi thì không bị văng lỗi 500
    try {
      await this.commerceRepository.removeRecentlyViewedItem(userId, courseId);
    } catch (_error) {
      // Bỏ qua lỗi nếu record không tồn tại
      return {
        message: MESSAGES.ACTIVITY.ERROR.NON_EXISTING(
          RESOURCES.COURSE,
          RESOURCES.RECENT_VIEWED_LIST
        ),
      };
    }
    return {
      message: MESSAGES.ACTIVITY.SUCCESS.REMOVED(RESOURCES.COURSE, RESOURCES.RECENT_VIEWED_LIST),
    };
  }

  public async clearRecentlyViewed(userId: string) {
    await this.commerceRepository.clearRecentlyViewed(userId);
    return { message: MESSAGES.ACTIVITY.SUCCESS.CLEARED(RESOURCES.RECENT_VIEWED_LIST) };
  }

  // ==========================================
  // [C] CART (GIỎ HÀNG)
  // ==========================================

  public async getCart(userId: string) {
    // 1. Lấy giỏ hàng và danh sách khóa học đã mua
    let cart = await this.commerceRepository.getOrCreateCart(userId);
    const ownedCourseIds = await this.commerceRepository.getUserOwnedCourseIds(userId);

    // 2. Cơ chế tự chữa lành (Self-healing / Dọn rác ngầm)
    // Nếu phát hiện trong giỏ có khóa học đã mua (do mua ở thiết bị khác), tự động xóa đi
    const hasOwnedItemsInCart = cart.items.some((item) => ownedCourseIds.includes(item.courseId));
    if (hasOwnedItemsInCart) {
      await this.commerceRepository.autoCleanOwnedItemsFromCart(cart.id, ownedCourseIds);
      cart = await this.commerceRepository.getOrCreateCart(userId); // Fetch lại giỏ mới
    }

    // 3. Tính toán tổng tiền (Backend tự tính, không tin Frontend)
    let totalPrice = 0;
    const formattedItems = cart.items.map((item) => {
      // (Tương lai): Nếu Course có trường discountPrice, ta sẽ tính toán ở đây
      const finalPrice = item.course.basePrice;
      totalPrice += Number(finalPrice);

      return {
        cartItemId: item.id,
        courseId: item.course.id,
        addedAt: item.createdAt,
        course: item.course,
      };
    });

    return {
      cartId: cart.id,
      totalItems: formattedItems.length,
      totalPrice: totalPrice,
      items: formattedItems,
    };
  }

  public async addToCart(userId: string, data: CartItemDTO) {
    const { courseId } = data;

    // RÀO CẢN 2: Chặn ngay nếu đã sở hữu
    const isOwned = await this.commerceRepository.checkEnrollmentExists(userId, courseId);
    if (isOwned) {
      throw new AppError(
        400,
        MESSAGES.CART.ERROR.OWNED(RESOURCES.COURSE),
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    const cart = await this.commerceRepository.getOrCreateCart(userId);

    // Check xem có trong giỏ chưa
    const existingItem = await this.commerceRepository.checkCartItemExists(cart.id, courseId);
    if (existingItem) {
      return { message: MESSAGES.CART.ERROR.EXISTING(RESOURCES.COURSE) };
    }

    await this.commerceRepository.addCartItem(cart.id, courseId);
    return { message: MESSAGES.ACTIVITY.SUCCESS.ADDED(RESOURCES.COURSE, RESOURCES.CART) };
  }

  public async removeCartItem(userId: string, courseId: string) {
    const cart = await this.commerceRepository.getOrCreateCart(userId);
    try {
      await this.commerceRepository.removeCartItem(cart.id, courseId);
    } catch (_error) {
      // Bỏ qua nếu item không tồn tại
      return { message: MESSAGES.ACTIVITY.ERROR.NON_EXISTING(RESOURCES.COURSE, RESOURCES.CART) };
    }
    return { message: MESSAGES.ACTIVITY.SUCCESS.REMOVED(RESOURCES.COURSE, RESOURCES.CART) };
  }

  public async clearCart(userId: string) {
    const cart = await this.commerceRepository.getOrCreateCart(userId);
    await this.commerceRepository.clearCart(cart.id);
    return { message: MESSAGES.ACTIVITY.SUCCESS.CLEARED(RESOURCES.CART) };
  }

  public async moveCartItemToWishlist(userId: string, courseId: string) {
    const cart = await this.commerceRepository.getOrCreateCart(userId);

    // Xóa khỏi Cart (nếu có lỗi vì không tồn tại cũng không sao)
    try {
      await this.commerceRepository.removeCartItem(cart.id, courseId);
    } catch (_error) {
      // Nếu không có trong giỏ, ta vẫn tiếp tục luồng để thêm vào Wishlist
    }

    // Thêm vào Wishlist (Nếu chưa có)
    const existingWishlist = await this.commerceRepository.checkWishlistExists(userId, courseId);
    if (!existingWishlist) {
      await this.commerceRepository.addToWishlist(userId, courseId);
    }

    return {
      message: MESSAGES.ACTIVITY.SUCCESS.MOVED(
        RESOURCES.COURSE,
        RESOURCES.CART,
        RESOURCES.WISHLIST_LIST
      ),
    };
  }

  // GỘP GIỎ HÀNG GUEST -> LOGGED IN (Rào cản 4)
  public async mergeGuestCart(userId: string, data: MergeGuestCartDTO) {
    const { courseIds } = data;
    if (!courseIds || courseIds.length === 0) {
      return this.getCart(userId); // Trả về giỏ hiện tại nếu FE không gửi gì
    }

    // 1. Lọc bỏ các khóa học đã mua (Enrollment)
    const ownedCourseIds = await this.commerceRepository.getUserOwnedCourseIds(userId);
    const validCourseIdsToMerge = courseIds.filter((id) => !ownedCourseIds.includes(id));

    // 2. Lấy Cart ID và thêm các khóa học hợp lệ vào DB
    const cart = await this.commerceRepository.getOrCreateCart(userId);
    await this.commerceRepository.addManyCartItems(cart.id, validCourseIdsToMerge);

    // 3. Trả về Giỏ hàng Server mới nhất để Frontend đè lên Zustand
    return this.getCart(userId);
  }

  // ==========================================
  // [D] VOUCHER (MÃ GIẢM GIÁ)
  // ==========================================

  // 1. Lấy "Ví Voucher" của tôi
  public async getMyVouchers(userId: string) {
    const userVouchers = await this.commerceRepository.getMyVouchers(userId);
    // Làm phẳng dữ liệu và tự động loại bỏ các mã đã hết hạn / chưa bắt đầu
    const now = new Date();
    return userVouchers
      .map((uv) => uv.voucher)
      .filter((v) => v.isActive && v.startDate <= now && (!v.expiresAt || v.expiresAt > now));
  }

  // 2. Lưu mã giảm giá
  public async saveVoucher(userId: string, code: string) {
    const voucher = await this.commerceRepository.getVoucherByCode(code);

    if (!voucher)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.VOUCHER),
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );

    // Check thời gian & trạng thái
    const now = new Date();
    if (
      !voucher.isActive ||
      voucher.startDate > now ||
      (voucher.expiresAt && voucher.expiresAt < now)
    ) {
      throw new AppError(400, MESSAGES.VOUCHER.ERROR.INVALID, ERROR_CODES.COMMON.INVALID_INPUT);
    }

    // Check lượt dùng tổng
    if (voucher.maxUsesTotal !== null && voucher.currentUses >= voucher.maxUsesTotal) {
      throw new AppError(400, MESSAGES.VOUCHER.ERROR.OFF_LIMIT, ERROR_CODES.COMMON.INVALID_INPUT);
    }

    // [BẢO MẬT]: Phân loại mã Public hay Private
    if (voucher.audience !== 'GLOBAL') {
      throw new AppError(403, MESSAGES.VOUCHER.ERROR.FORBIDDEN, ERROR_CODES.COMMON.FORBIDDEN);
    }

    // Kiểm tra xem user đã lưu chưa
    const existing = await this.commerceRepository.checkUserVoucherExists(userId, voucher.id);
    if (existing)
      throw new AppError(
        400,
        MESSAGES.VOUCHER.ERROR.HAVE_NOT_SAVED,
        ERROR_CODES.COMMON.INVALID_INPUT
      );

    await this.commerceRepository.saveUserVoucher(userId, voucher.id);
    return { message: MESSAGES.ACTIVITY.SUCCESS.SAVED(RESOURCES.VOUCHER, RESOURCES.VOUCHER_LIST) };
  }

  // 3. Gợi ý mã có thể áp dụng cho Giỏ hàng hiện tại
  public async getApplicableVouchers(userId: string) {
    const cartData = await this.getCart(userId);
    const cartTotal = new Decimal(cartData.totalPrice);

    // Dùng lại hàm getMyVouchers (đã lọc thời gian sẵn)
    const activeVouchers = await this.getMyVouchers(userId);

    // Lọc ra các mã có minOrderValue <= Tổng tiền giỏ hàng và còn lượt
    const applicableVouchers = activeVouchers.filter((v) => {
      const isNotExhausted = v.maxUsesTotal === null || v.currentUses < v.maxUsesTotal;
      const minOrder = new Decimal(v.minOrderValue || 0);
      return isNotExhausted && cartTotal.greaterThanOrEqualTo(minOrder);
    });

    return applicableVouchers;
  }

  // 4. Tính thử giá (Apply) - NGHỆ THUẬT XỬ LÝ TOÁN HỌC
  public async applyVoucher(userId: string, data: ApplyVoucherDTO) {
    const { voucherId } = data;

    // A. Lấy Giỏ hàng
    const cartData = await this.getCart(userId);
    if (cartData.totalItems === 0) {
      throw new AppError(400, MESSAGES.VOUCHER.ERROR.EMPTY_CART, ERROR_CODES.COMMON.INVALID_INPUT);
    }
    const cartTotal = new Decimal(cartData.totalPrice);

    // B. Kiểm tra quyền sở hữu trong ví
    const userVoucher = await this.commerceRepository.checkUserVoucherExists(userId, voucherId);
    if (!userVoucher || userVoucher.isUsed) {
      throw new AppError(400, MESSAGES.VOUCHER.ERROR.NOT_OWNED, ERROR_CODES.COMMON.INVALID_INPUT);
    }

    const voucher = await this.commerceRepository.getVoucherById(voucherId);
    const now = new Date();

    if (
      !voucher ||
      !voucher.isActive ||
      voucher.startDate > now ||
      (voucher.expiresAt && voucher.expiresAt < now)
    ) {
      throw new AppError(400, MESSAGES.VOUCHER.ERROR.INVALID, ERROR_CODES.COMMON.INVALID_INPUT);
    }

    if (voucher.maxUsesTotal !== null && voucher.currentUses >= voucher.maxUsesTotal) {
      throw new AppError(400, MESSAGES.VOUCHER.ERROR.OFF_LIMIT, ERROR_CODES.COMMON.INVALID_INPUT);
    }

    const minOrder = new Decimal(voucher.minOrderValue || 0);
    if (cartTotal.lessThan(minOrder)) {
      throw new AppError(
        400,
        MESSAGES.VOUCHER.ERROR.MIN_ORDER_VALUE(minOrder.toNumber()),
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    // C. Tính toán giảm giá bằng Decimal.js
    let discountAmount = new Decimal(0);
    const voucherValue = new Decimal(voucher.value);

    if (voucher.type === 'FIXED_AMOUNT') {
      discountAmount = voucherValue;
    } else if (voucher.type === 'PERCENTAGE') {
      discountAmount = cartTotal.times(voucherValue).dividedBy(100);

      // Giới hạn số tiền giảm tối đa (Nếu có maxDiscountAmount)
      if (voucher.maxDiscountAmount) {
        const maxDiscount = new Decimal(voucher.maxDiscountAmount);
        if (discountAmount.greaterThan(maxDiscount)) {
          discountAmount = maxDiscount;
        }
      }
    }

    // D. Tổng kết (Không được để số tiền âm)
    let finalPrice = cartTotal.minus(discountAmount);
    if (finalPrice.isNegative()) {
      finalPrice = new Decimal(0);
      discountAmount = cartTotal; // Giảm tối đa bằng giá trị đơn hàng
    }

    return {
      cartTotal: cartTotal.toNumber(),
      discountAmount: Math.round(discountAmount.toNumber()),
      finalPrice: Math.round(finalPrice.toNumber()),
      voucherApplied: {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
      },
    };
  }

  // ==========================================
  // [E] CHECKOUT & PAYMENTS
  // ==========================================

  public async checkout(userId: string, data: CheckoutDTO) {
    const { voucherId } = data;

    // 1. Lấy Giỏ hàng và Tính tổng tiền
    const cartData = await this.getCart(userId);
    if (cartData.totalItems === 0) {
      throw new AppError(400, MESSAGES.CART.ERROR.EMPTY, ERROR_CODES.COMMON.INVALID_INPUT);
    }
    const cartTotal = new Decimal(cartData.totalPrice);
    const courseIds = cartData.items.map((item) => item.course.id);

    // 2. CHỐNG CLICK ĐÚP: Kiểm tra xem có đơn PENDING nào chứa các khóa này không
    const existingPendingOrder = await this.commerceRepository.checkPendingOrderForCourses(
      userId,
      courseIds
    );
    if (existingPendingOrder) {
      throw new AppError(400, MESSAGES.ORDER.ERROR.PENDING, ERROR_CODES.COMMON.INVALID_INPUT);
    }

    // 3. Tính toán Giảm giá (Nếu có Voucher)
    let finalAmount = cartTotal;
    let currentVoucherVersion: number | undefined = undefined;

    if (voucherId) {
      // Dùng lại hàm applyVoucher để tận dụng logic tính tiền an toàn
      const applyResult = await this.applyVoucher(userId, { voucherId });
      finalAmount = new Decimal(applyResult.finalPrice);

      const voucherInfo = await this.commerceRepository.getVoucherById(voucherId);
      currentVoucherVersion = voucherInfo?.version;
    }

    // 4. Tạo Đơn hàng qua Transaction
    try {
      const order = await this.commerceRepository.createOrderTransaction(
        userId,
        cartData.cartId,
        cartData.items,
        finalAmount.toNumber(), // Truyền đúng số tiền cuối cần thanh toán
        voucherId,
        currentVoucherVersion
      );

      return {
        orderId: order.id,
        totalAmount: order.totalAmount,
        message: MESSAGES.ORDER.SUCCESS.CREATED,
      };
    } catch (error: any) {
      if (error.message === 'VOUCHER_RACE_CONDITION') {
        throw new AppError(
          409,
          MESSAGES.VOUCHER.ERROR.RACE_CONDITION,
          ERROR_CODES.COMMON.INVALID_INPUT
        );
      }
      throw error;
    }
  }

  // TẠO URL THANH TOÁN (VNPAY / MOMO)
  public async createPaymentUrl(userId: string, orderId: string, provider: string, ipAddr: string) {
    const order = await this.commerceRepository.getOrderById(orderId, userId);
    if (!order)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.ORDER),
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );
    if (order.status !== 'PENDING')
      throw new AppError(
        400,
        MESSAGES.ORDER.ERROR.STATUS(order.status),
        ERROR_CODES.COMMON.INVALID_INPUT
      );

    //  Xử lý đơn hàng 0 Đồng (Được giảm giá 100%)
    if (Number(order.totalAmount) === 0) {
      // 1. Tự động đánh dấu đơn hàng thành công (Bạn cần viết hàm này trong Repository)
      await this.commerceRepository.markOrderAsSuccessFreeOfCharge(order.id, userId);
      // 2. Trả về một URL đặc biệt để FE redirect thẳng vào trang "Thanh toán thành công"
      return { paymentUrl: `${env.CLIENT_URL}/checkout/success?orderId=${order.id}` };
    }

    // Tạo 1 record Payment mới cho lần thử này
    const payment = await this.commerceRepository.createPaymentAttempt(
      order.id,
      provider,
      Number(order.totalAmount)
    );

    // [VNPAY LOGIC]
    if (provider === 'VNPAY') {
      const tmnCode = env.VNPAY_TMN_CODE || process.env.VNPAY_TMN_CODE || 'MOCK_TMN';
      const secretKey = env.VNPAY_HASH_SECRET || process.env.VNPAY_HASH_SECRET || 'MOCK_SECRET_KEY';
      const vnpUrl =
        env.VNPAY_URL ||
        process.env.VNPAY_URL ||
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
      const returnUrl =
        env.VNPAY_RETURN_URL ||
        process.env.VNPAY_RETURN_URL ||
        'http://localhost:3000/vnpay-return';

      if (!tmnCode || !secretKey) {
        throw new AppError(
          500,
          'Lỗi cấu hình hệ thống thanh toán VNPAY',
          ERROR_CODES.COMMON.INTERNAL_SERVER_ERROR
        );
      }

      // ÉP CỨNG MÚI GIỜ GMT+7 (Tránh lỗi Hết hạn giao dịch)
      const date = new Date();
      const createDate = moment(date).tz('Asia/Ho_Chi_Minh').format('YYYYMMDDHHmmss');
      // Set ngày hết hạn (15 phút sau)
      const expireDate = moment(date)
        .add(15, 'minutes')
        .tz('Asia/Ho_Chi_Minh')
        .format('YYYYMMDDHHmmss');

      let vnp_Params: Record<string, string | number> = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: payment.id,
        vnp_OrderInfo: `Thanh toan don hang ${order.id}`,
        vnp_OrderType: 'other',
        vnp_Amount: Math.round(Number(payment.amount) * 100), // BẮT BUỘC NHÂN 100
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate,
      };

      // Sắp xếp params theo chuẩn VNPAY
      vnp_Params = this.sortObject(vnp_Params);

      const signData = querystring.stringify(vnp_Params, { encode: false });
      const hmac = crypto.createHmac('sha512', secretKey);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      vnp_Params['vnp_SecureHash'] = signed;

      const paymentUrl = vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false });
      return { paymentUrl };
    }

    // [MOMO LOGIC] - Tương lai
    if (provider === 'MOMO') {
      // Thực hiện call API POST sang MoMo để lấy payUrl
      // Tạm thời trả về lỗi 501 Not Implemented nếu chưa triển khai
      throw new AppError(
        501,
        MESSAGES.PAYMENT.ERROR.MOMO_NOT_IMPLEMENTED,
        ERROR_CODES.COMMON.INTERNAL_SERVER_ERROR
      );
    }

    throw new AppError(
      400,
      MESSAGES.PAYMENT.ERROR.INVALID_PAYMENT_METHOD,
      ERROR_CODES.COMMON.INVALID_INPUT
    );
  }

  // Hàm Helper Sort cho VNPAY (Dùng lại từ Webhook)
  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const encodedKeys = Object.keys(obj)
      .filter((key) => Object.prototype.hasOwnProperty.call(obj, key))
      .map((key) => encodeURIComponent(key))
      .sort();

    for (const currentKey of encodedKeys) {
      const originalKey = decodeURIComponent(currentKey);
      const value = obj[originalKey];
      sorted[currentKey] = encodeURIComponent(String(value)).replace(/%20/g, '+');
    }
    return sorted;
  }

  // ==========================================
  // [F] ORDER HISTORY & POLLING
  // ==========================================

  public async getMyOrders(userId: string) {
    const orders = await this.commerceRepository.getOrderHistory(userId);
    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        title: item.course.title,
        thumbnailUrl: item.course.thumbnailUrl,
        pricePaid: item.pricePaid,
      })),
    }));
  }

  public async getOrderDetails(userId: string, orderId: string) {
    const order = await this.commerceRepository.getOrderDetails(orderId, userId);
    if (!order)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.ORDER),
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );
    return order;
  }

  // Hàm dành cho FE gọi liên tục mỗi 2s sau khi thanh toán xong
  public async pollOrderStatus(userId: string, orderId: string) {
    const order = await this.commerceRepository.getOrderStatus(orderId, userId);

    if (!order)
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.ORDER),
        ERROR_CODES.DATABASE.RECORD_NOT_FOUND
      );

    return { status: order.status };
  }
}
