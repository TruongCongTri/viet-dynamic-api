import { AdminDiscountRepository, AdminVoucherRepository } from './admin-marketing.repository';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { PaginationMetaDto } from '@/data/dtos/pagination.dto';
import { CreateDiscountDTO, CreateVoucherDTO } from './admin-marketing.schema';

export class AdminMarketingService {
  private readonly discountRepo: AdminDiscountRepository;
  private readonly voucherRepo: AdminVoucherRepository;

  constructor() {
    this.discountRepo = new AdminDiscountRepository();
    this.voucherRepo = new AdminVoucherRepository();
  }

  // ==========================================
  // [A] DISCOUNTS (KHUYẾN MÃI TỰ ĐỘNG)
  // ==========================================
  public async getDiscounts(query: any) {
    const { total, data } = await this.discountRepo.findDiscounts(query);
    const meta = PaginationMetaDto.create(query.page || 1, query.limit || 20, total);
    return { data, meta };
  }

  public async getDiscountDetail(id: string) {
    const discount = await this.discountRepo.getDiscountDetail(id);
    if (!discount)
      throw new AppError(404, 'Chiến dịch không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    return discount;
  }

  public async createDiscount(data: CreateDiscountDTO) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new AppError(
        400,
        'Ngày kết thúc phải lớn hơn ngày bắt đầu',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }
    return this.discountRepo.createDiscount(data);
  }

  public async updateDiscount(id: string, data: Partial<CreateDiscountDTO>) {
    return this.discountRepo.update(id, data);
  }

  public async toggleDiscountStatus(id: string, isActive: boolean) {
    return this.discountRepo.update(id, { isActive });
  }

  public async attachCoursesToDiscount(id: string, courseIds: string[]) {
    const discount = await this.discountRepo.findById(id);
    if (!discount)
      throw new AppError(404, 'Chiến dịch không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    if (discount.isGlobal)
      throw new AppError(
        400,
        'Chiến dịch này áp dụng toàn sàn, không cần gán khóa học lẻ',
        ERROR_CODES.COMMON.INVALID_INPUT
      );

    await this.discountRepo.attachCourses(id, courseIds);
    return { message: 'Cập nhật danh sách khóa học tham gia Sale thành công' };
  }

  // ==========================================
  // [B] VOUCHERS (MÃ GIẢM GIÁ)
  // ==========================================
  public async getVouchers(query: any) {
    const { total, data } = await this.voucherRepo.findVouchers(query);
    const meta = PaginationMetaDto.create(query.page || 1, query.limit || 20, total);
    return { data, meta };
  }

  public async getVoucherDetail(id: string) {
    const voucher = await this.voucherRepo.findById(id);
    if (!voucher)
      throw new AppError(404, 'Voucher không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    // Gọi Database để lấy thông kê doanh thu thực tế mang về
    const stats = await this.voucherRepo.getVoucherStats(id);

    return {
      ...voucher,
      stats, // Trả về { revenueGenerated, totalOrdersUsed } cho Frontend vẽ biểu đồ
    };
  }

  public async createVoucher(data: CreateVoucherDTO) {
    const existing = await this.voucherRepo.checkCodeExists(data.code);
    if (existing)
      throw new AppError(
        409,
        'Mã Code này đã tồn tại trên hệ thống',
        ERROR_CODES.COMMON.INVALID_INPUT
      );

    return this.voucherRepo.createVoucher(data);
  }

  public async updateVoucher(id: string, data: Partial<CreateVoucherDTO>) {
    return this.voucherRepo.update(id, data);
  }

  public async toggleVoucherStatus(id: string, isActive: boolean) {
    return this.voucherRepo.update(id, { isActive });
  }

  public async giftVoucher(id: string, userIds: string[]) {
    const voucher = await this.voucherRepo.findById(id);
    if (!voucher)
      throw new AppError(404, 'Voucher không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    if (voucher.audience !== 'SPECIFIC_USERS') {
      throw new AppError(
        400,
        'Chỉ được phép Airdrop (tặng) các mã ẩn dành riêng cho SPECIFIC_USERS',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    const result = await this.voucherRepo.giftVoucherToUsers(id, userIds);
    return { message: `Đã airdrop mã giảm giá thành công cho ${result.count} người dùng.` };
  }
}
