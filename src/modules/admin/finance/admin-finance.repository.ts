import { prisma } from '@/common/configs/prisma.config';
import { BaseRepository } from '@/common/repositories/base.repository';
import { Order, Prisma } from '@prisma/client';

export class AdminFinanceRepository extends BaseRepository<Order> {
  constructor() {
    super('order');
  }

  // ==========================================
  // [A] ORDER AUDIT (TRA SOÁT ĐƠN HÀNG)
  // ==========================================
  public async findOrders(params: any) {
    const { page = 1, limit = 20, status, paymentProvider, search, fromDate, toDate } = params;
    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (search) where.user = { email: { contains: search, mode: 'insensitive' } };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }
    // Lọc theo provider thông qua bảng Payment liên kết
    if (paymentProvider) {
      where.payments = { some: { provider: paymentProvider } };
    }

    return this.executePagination<Order>({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, profile: { select: { fullName: true } } } },
      },
    });
  }

  public async getOrderDetail(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, profile: { select: { fullName: true } } } },
        items: { include: { course: { select: { id: true, title: true, slug: true } } } },
        payments: { orderBy: { createdAt: 'desc' } }, // Lịch sử thử quẹt thẻ
        voucher: true,
      },
    });
  }

  public async getPaymentPayload(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      select: { webhookPayload: true, status: true, provider: true },
    });
  }

  // ==========================================
  // [B] HOÀN TIỀN & DỌN RÁC (TRANSACTIONS)
  // ==========================================
  public async refundOrderTransaction(orderId: string, userId: string, courseIds: string[]) {
    // 1. Chuyển trạng thái Order thành REFUNDED [cite: 778]
    // 2. Xóa học viên khỏi bảng Enrollment (Trảm quyền truy cập) [cite: 778, 790, 791]
    return prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      if (courseIds.length > 0) {
        await tx.enrollment.deleteMany({
          where: { userId, courseId: { in: courseIds } },
        });

        // Giảm studentCount của Khóa học
        await tx.course.updateMany({
          where: { id: { in: courseIds } },
          data: { studentCount: { decrement: 1 } },
        });
      }

      return updatedOrder;
    });
  }

  public async cleanupPendingTrash() {
    const expireTime = new Date(Date.now() - 15 * 60 * 1000); // Quá hạn 15 phút [cite: 333, 335]

    const expiredOrders = await prisma.order.findMany({
      where: { status: 'PENDING', createdAt: { lt: expireTime } },
      select: { id: true, voucherId: true },
    });

    if (expiredOrders.length === 0) return 0;

    await prisma.$transaction(async (tx) => {
      const orderIds = expiredOrders.map((o) => o.id);

      // Đổi trạng thái Order thành CANCELLED [cite: 778]
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: 'CANCELLED' },
      });

      // Nhả Voucher [cite: 778, 786, 787, 788, 789]
      for (const order of expiredOrders) {
        if (order.voucherId) {
          await tx.voucher.update({
            where: { id: order.voucherId },
            data: { currentUses: { decrement: 1 } },
          });
        }
      }
    });

    return expiredOrders.length;
  }

  // ==========================================
  // [C] THỐNG KÊ (ANALYTICS)
  // ==========================================
  public async getFinanceOverview() {
    const result = await prisma.order.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalRevenue = result._sum.totalAmount ? result._sum.totalAmount.toNumber() : 0;
    const totalOrders = result._count.id;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
    };
  }

  public async syncOrderSuccess(orderId: string, userId: string, paymentId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;

    return prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái
      await tx.order.update({ where: { id: orderId }, data: { status: 'SUCCESS' } });
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'SUCCESS' } });

      const courseIds = order.items.map((i) => i.courseId);
      if (courseIds.length > 0) {
        // 2. Cấp quyền truy cập khóa học
        await tx.enrollment.createMany({
          data: courseIds.map((courseId) => ({ userId, courseId })),
          skipDuplicates: true, // Chống nổ DB nếu user lỡ có quyền rồi
        });

        // 3. Cập nhật thống kê
        await tx.course.updateMany({
          where: { id: { in: courseIds } },
          data: { studentCount: { increment: 1 } },
        });
      }
    });
  }

  public async getCourseRevenueStats() {
    const stats = await prisma.orderItem.groupBy({
      by: ['courseId'],
      where: { order: { status: 'SUCCESS' } },
      _sum: { pricePaid: true },
      _count: { id: true },
    });

    const courseIds = stats.map((s) => s.courseId);
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    });

    return stats
      .map((stat) => {
        const course = courses.find((c) => c.id === stat.courseId);
        return {
          courseId: stat.courseId,
          courseTitle: course?.title || 'Khóa học không xác định',
          // Ép kiểu Decimal nghiêm ngặt
          totalRevenue: stat._sum.pricePaid ? stat._sum.pricePaid.toNumber() : 0,
          totalSold: stat._count.id,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue); // Doanh thu cao xếp trước
  }
}
