import { prisma } from '@/common/configs/prisma.config';
import { BaseRepository } from '@/common/repositories/base.repository';
import { Discount, Voucher } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

export class AdminDiscountRepository extends BaseRepository<Discount> {
  constructor() {
    super('discount');
  }

  public async findDiscounts(params: any) {
    const { page = 1, limit = 20, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return this.executePagination<Discount>({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { _count: { select: { courses: true } } },
    });
  }

  public async getDiscountDetail(id: string) {
    return this.findById(id, {
      include: { courses: { include: { course: { select: { id: true, title: true } } } } },
    });
  }

  public async attachCourses(discountId: string, courseIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.courseDiscount.deleteMany({ where: { discountId } });
      if (courseIds.length > 0) {
        await tx.courseDiscount.createMany({
          data: courseIds.map((courseId) => ({ discountId, courseId })),
        });
      }
    });
  }

  public async createDiscount(data: any) {
    return this.model.create({ data });
  }
}

export class AdminVoucherRepository extends BaseRepository<Voucher> {
  constructor() {
    super('voucher');
  }

  public async findVouchers(params: any) {
    const {
      page = 1,
      limit = 20,
      search,
      audience,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;
    const where: any = {};
    if (search) where.code = { contains: search, mode: 'insensitive' };
    if (audience) where.audience = audience;

    return this.executePagination<Voucher>({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });
  }

  public async checkCodeExists(code: string) {
    return prisma.voucher.findUnique({ where: { code } });
  }

  public async giftVoucherToUsers(voucherId: string, userIds: string[]) {
    // Tạo sẵn UserVoucher để mã hiển thị trong Ví của học viên
    return prisma.userVoucher.createMany({
      data: userIds.map((userId) => ({ userId, voucherId, isUsed: false })),
      skipDuplicates: true, // Tránh lỗi nếu user đã được tặng rồi
    });
  }

  public async createVoucher(data: any) {
    return this.model.create({
      data: {
        code: data.code,
        type: data.type,
        // Đảm bảo value là Decimal
        value: new Decimal(data.value),
        audience: data.audience,
        startDate: new Date(data.startDate),
        // Đổi endDate (API) -> expiresAt (DB)
        expiresAt: data.endDate ? new Date(data.endDate) : undefined,
        isActive: data.isActive ?? true,
        minOrderValue: data.minOrderValue ? new Decimal(data.minOrderValue) : null,
        maxDiscountAmount: data.maxDiscountAmount ? new Decimal(data.maxDiscountAmount) : null,
        maxUsesTotal: data.maxUsesTotal,
        maxUsesPerUser: data.maxUsesPerUser,
      },
    });
  }
  public async getVoucherStats(voucherId: string) {
    const stats = await prisma.order.aggregate({
      where: {
        voucherId: voucherId,
        status: 'SUCCESS', // Chỉ tính những hóa đơn đã thu được tiền
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    return {
      // Phải ép kiểu Decimal về Number để Frontend dễ xài
      revenueGenerated: stats._sum.totalAmount ? stats._sum.totalAmount.toNumber() : 0,
      totalOrdersUsed: stats._count.id,
    };
  }
}
