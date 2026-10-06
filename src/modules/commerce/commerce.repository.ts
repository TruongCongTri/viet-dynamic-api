import { prisma } from '@/common/configs/prisma.config';
import { BaseRepository } from '@/common/repositories/base.repository';
import { Course } from '@prisma/client';

export class CommerceRepository extends BaseRepository<Course> {
  constructor() {
    super('course');
  }
  // ==========================================
  // [A] WISHLIST (YÊU THÍCH)
  // ==========================================

  public async getWishlist(userId: string) {
    return prisma.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            basePrice: true,
            averageRating: true,
            studentCount: true,
            status: true,
          },
        },
      },
    });
  }

  public async checkWishlistExists(userId: string, courseId: string) {
    return prisma.wishlist.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  public async addToWishlist(userId: string, courseId: string) {
    return prisma.wishlist.create({ data: { userId, courseId } });
  }

  public async removeFromWishlist(userId: string, courseId: string) {
    return prisma.wishlist.delete({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  public async clearWishlist(userId: string) {
    return prisma.wishlist.deleteMany({ where: { userId } });
  }

  // ==========================================
  // [B] RECENTLY VIEWED (LỊCH SỬ XEM)
  // ==========================================

  public async getRecentlyViewed(userId: string) {
    return prisma.recentlyViewed.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' }, // Mới nhất lên đầu
      take: 15, // Chỉ lấy 15 khóa để tối ưu hiệu năng
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            basePrice: true,
            averageRating: true,
            studentCount: true,
            status: true,
          },
        },
      },
    });
  }

  public async getCourseIdBySlug(slug: string) {
    return prisma.course.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true },
    });
  }

  public async trackRecentlyViewed(userId: string, courseId: string) {
    // Dùng upsert: Nếu chưa có thì tạo, có rồi thì update thời gian
    return prisma.recentlyViewed.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { viewedAt: new Date() },
      create: { userId, courseId },
    });
  }

  public async removeRecentlyViewedItem(userId: string, courseId: string) {
    return prisma.recentlyViewed.delete({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  public async clearRecentlyViewed(userId: string) {
    return prisma.recentlyViewed.deleteMany({ where: { userId } });
  }

  // ==========================================
  // [C] CART (GIỎ HÀNG) & ENROLLMENT CHECKS
  // ==========================================

  // 1. Kiểm tra sở hữu (Chống mua trùng)
  public async checkEnrollmentExists(userId: string, courseId: string) {
    return prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  // 2. Lấy danh sách ID khóa học đã sở hữu (Dùng cho Merge Cart)
  public async getUserOwnedCourseIds(userId: string) {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    return enrollments.map((e) => e.courseId);
  }

  // 3. Lấy/Tạo Giỏ hàng (Upsert - Luôn đảm bảo user có giỏ hàng)
  public async getOrCreateCart(userId: string) {
    return prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: {
        items: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnailUrl: true,
                basePrice: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  public async checkCartItemExists(cartId: string, courseId: string) {
    return prisma.cartItem.findUnique({
      where: { cartId_courseId: { cartId, courseId } },
    });
  }

  public async addCartItem(cartId: string, courseId: string) {
    return prisma.cartItem.create({ data: { cartId, courseId } });
  }

  public async removeCartItem(cartId: string, courseId: string) {
    return prisma.cartItem.delete({
      where: { cartId_courseId: { cartId, courseId } },
    });
  }

  public async clearCart(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  }

  // Transaction: Dọn rác giỏ hàng (Xóa các item mà user đã lỡ mua trên thiết bị khác)
  public async autoCleanOwnedItemsFromCart(cartId: string, ownedCourseIds: string[]) {
    if (ownedCourseIds.length === 0) return;
    return prisma.cartItem.deleteMany({
      where: {
        cartId: cartId,
        courseId: { in: ownedCourseIds },
      },
    });
  }

  // Thêm nhiều item cùng lúc (Dùng cho Merge)
  public async addManyCartItems(cartId: string, courseIds: string[]) {
    // Lọc bỏ những courseId đã có trong giỏ trước khi insert để tránh lỗi Unique
    const existingItems = await prisma.cartItem.findMany({
      where: { cartId, courseId: { in: courseIds } },
      select: { courseId: true },
    });

    const existingIds = existingItems.map((item) => item.courseId);
    const newCourseIds = courseIds.filter((id) => !existingIds.includes(id));

    if (newCourseIds.length === 0) return 0;

    const createData = newCourseIds.map((courseId) => ({ cartId, courseId }));
    const result = await prisma.cartItem.createMany({ data: createData });
    return result.count;
  }

  // ==========================================
  // [D] VOUCHER (MÃ GIẢM GIÁ)
  // ==========================================

  public async getMyVouchers(userId: string) {
    return prisma.userVoucher.findMany({
      where: {
        userId,
        isUsed: false,
        voucher: { expiresAt: { gt: new Date() } }, // Chỉ lấy mã chưa hết hạn
      },
      include: { voucher: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async getVoucherByCode(code: string) {
    return prisma.voucher.findUnique({ where: { code } });
  }

  public async getVoucherById(id: string) {
    return prisma.voucher.findUnique({ where: { id } });
  }

  public async checkUserVoucherExists(userId: string, voucherId: string) {
    return prisma.userVoucher.findUnique({
      where: { userId_voucherId: { userId, voucherId } },
    });
  }

  public async saveUserVoucher(userId: string, voucherId: string) {
    return prisma.userVoucher.create({
      data: { userId, voucherId },
    });
  }

  // ==========================================
  // [E] CHECKOUT & ORDERS
  // ==========================================

  // 1. Kiểm tra Đơn hàng PENDING (Chống Click Đúp)
  public async checkPendingOrderForCourses(userId: string, courseIds: string[]) {
    return prisma.order.findFirst({
      where: {
        userId,
        status: 'PENDING',
        items: { some: { courseId: { in: courseIds } } },
      },
    });
  }

  // 2. Transaction Tạo Đơn Hàng Mới
  public async createOrderTransaction(
    userId: string,
    cartId: string,
    cartItems: any[], // Mảng các item trong giỏ
    finalAmount: number, // Số tiền cuối cùng sau giảm giá
    voucherId?: string,
    voucherVersion?: number
  ) {
    return prisma.$transaction(async (tx) => {
      // A. Nếu có dùng Voucher -> Trừ lượt dùng bằng Optimistic Locking
      if (voucherId && voucherVersion !== undefined) {
        const updatedVoucher = await tx.voucher.updateMany({
          where: {
            id: voucherId,
            version: voucherVersion, // Điều kiện then chốt chống Race Condition
            currentUses: { lt: prisma.voucher.fields.maxUsesTotal }, // Còn lượt
          },
          data: {
            currentUses: { increment: 1 },
            version: { increment: 1 }, // Tăng version lên để người đến sau bị fail
          },
        });

        // Nếu count = 0 nghĩa là trong tích tắc vừa rồi có người khác đã xài mã làm tăng version
        if (updatedVoucher.count === 0) {
          throw new Error('VOUCHER_RACE_CONDITION');
        }

        // B. Đánh dấu UserVoucher là đã dùng
        await tx.userVoucher.update({
          where: { userId_voucherId: { userId, voucherId } },
          data: { isUsed: true, usedAt: new Date() },
        });
      }

      // B. Tạo Đơn hàng (Order)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Hết hạn sau 15 phút

      // C. Tạo Đơn hàng (Order)
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: finalAmount, // Lưu giá cuối cùng vào totalAmount
          status: 'PENDING',
          expiresAt, // Cột hỗ trợ Cronjob
          voucherId: voucherId || null,
          items: {
            create: cartItems.map((item) => ({
              courseId: item.courseId,
              pricePaid: item.course.basePrice, // Đã đổi thành pricePaid theo Schema
            })),
          },
        },
      });

      // D. Dọn sạch Giỏ hàng
      await tx.cartItem.deleteMany({ where: { cartId } });

      return newOrder;
    });
  }

  public async getOrderById(orderId: string, userId: string) {
    return prisma.order.findUnique({
      where: { id: orderId, userId },
    });
  }

  // Tạo lượt thử thanh toán (Payment Attempt)
  public async createPaymentAttempt(orderId: string, provider: string, amount: number) {
    return prisma.payment.create({
      data: {
        orderId,
        provider,
        amount,
        status: 'PENDING',
      },
    });
  }

  // ==========================================
  // [F] ORDER HISTORY & POLLING
  // ==========================================

  public async getOrderHistory(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            course: { select: { title: true, thumbnailUrl: true } },
          },
        },
      },
    });
  }

  public async getOrderDetails(orderId: string, userId: string) {
    return prisma.order.findUnique({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            course: { select: { title: true, slug: true, thumbnailUrl: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' }, // Lấy lịch sử giao dịch, mới nhất lên đầu
        },
        voucher: { select: { code: true, type: true, value: true } },
      },
    });
  }

  // ==========================================
  // [G] SPECIAL OPERATIONS & POLLING
  // ==========================================

  /**
   * Lấy trạng thái đơn hàng (Tối ưu hóa query, chỉ select field status)
   */
  public async getOrderStatus(orderId: string, userId: string) {
    return prisma.order.findUnique({
      where: { id: orderId, userId },
      select: { status: true },
    });
  }

  /**
   * Xử lý luồng "Đơn hàng 0 Đồng" (Được giảm giá 100% bằng Voucher)
   * Bypass cổng thanh toán và cấp quyền ngay lập tức bằng Transaction
   */
  public async markOrderAsSuccessFreeOfCharge(orderId: string, userId: string) {
    // 1. Lấy thông tin các khóa học nằm trong đơn hàng này
    const order = await prisma.order.findUnique({
      where: { id: orderId, userId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Đơn hàng không tồn tại hoặc không thuộc về người dùng này.');
    }

    // 2. Thực thi Transaction (Giao dịch nguyên tử)
    return prisma.$transaction(async (tx) => {
      // A. Chuyển trạng thái hóa đơn thành SUCCESS
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'SUCCESS' },
      });

      // B. Kích hoạt khóa học (Thêm vào bảng Enrollment)
      const enrollmentsData = order.items.map((item) => ({
        userId: userId,
        courseId: item.courseId,
      }));

      if (enrollmentsData.length > 0) {
        await tx.enrollment.createMany({
          data: enrollmentsData,
          skipDuplicates: true, // Tránh lỗi văng hệ thống nếu user lỡ sở hữu từ trước
        });
      }

      // 💡 [Tương lai]: Nếu hệ thống của bạn có lưu cứng trường studentCount
      // Bạn có thể viết thêm vòng lặp ở đây để gọi lệnh tăng (increment)
      // tổng số học viên cho Khóa học (Course) và Giảng viên (UserProfile) tương ứng.

      return updatedOrder;
    });
  }
}
