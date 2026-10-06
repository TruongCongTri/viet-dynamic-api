import { AdminMarketingService } from './admin-marketing.service';
import { AdminDiscountRepository, AdminVoucherRepository } from './admin-marketing.repository';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('./admin-marketing.repository');

describe('AdminMarketingService (Unit Tests)', () => {
  let service: AdminMarketingService;
  let mockDiscountRepo: jest.Mocked<AdminDiscountRepository>;
  let mockVoucherRepo: jest.Mocked<AdminVoucherRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscountRepo = new AdminDiscountRepository() as jest.Mocked<AdminDiscountRepository>;
    mockVoucherRepo = new AdminVoucherRepository() as jest.Mocked<AdminVoucherRepository>;

    service = new AdminMarketingService();
    (service as any).discountRepo = mockDiscountRepo;
    (service as any).voucherRepo = mockVoucherRepo;
  });

  // ==========================================
  // [A] DISCOUNTS (Khuyến mãi tự động)
  // ==========================================
  describe('Discounts Management', () => {
    it('1. Nên lấy danh sách Discounts kèm phân trang', async () => {
      mockDiscountRepo.findDiscounts.mockResolvedValueOnce({
        total: 10,
        data: [{ id: 'd-1' }],
      } as any);
      const res = await service.getDiscounts({ page: 1, limit: 5 });
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(10);
    });

    it('2. Lỗi 404: Lấy chi tiết Discount không tồn tại', async () => {
      mockDiscountRepo.getDiscountDetail.mockResolvedValueOnce(null);
      await expect(service.getDiscountDetail('ghost')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('3. Lỗi 400: Tạo Discount có Start Date >= End Date', async () => {
      const payload = { startDate: '2026-12-31', endDate: '2026-01-01' } as any;
      await expect(service.createDiscount(payload)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('4. Nên tạo Discount thành công', async () => {
      mockDiscountRepo.createDiscount.mockResolvedValueOnce({ id: 'd-new' } as any);
      const payload = { startDate: '2026-01-01', endDate: '2026-12-31' } as any;
      const res = await service.createDiscount(payload);
      expect(res.id).toBe('d-new');
    });

    it('5. Nên Toggle trạng thái Discount', async () => {
      (mockDiscountRepo as any).update.mockResolvedValueOnce({ isActive: false } as any);
      const res = await service.toggleDiscountStatus('d-1', false);
      expect(res.isActive).toBe(false);
      expect((mockDiscountRepo as any).update).toHaveBeenCalledWith('d-1', { isActive: false });
    });

    it('6. Lỗi 404: Gắn khóa học vào Discount không tồn tại', async () => {
      (mockDiscountRepo as any).findById.mockResolvedValueOnce(null);
      await expect(service.attachCoursesToDiscount('ghost', ['c-1'])).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('7. Lỗi 400: Gắn khóa học vào Discount Global (Toàn sàn)', async () => {
      (mockDiscountRepo as any).findById.mockResolvedValueOnce({ isGlobal: true } as any);
      await expect(service.attachCoursesToDiscount('d-1', ['c-1'])).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('8. Nên gắn khóa học vào Discount cục bộ thành công', async () => {
      (mockDiscountRepo as any).findById.mockResolvedValueOnce({ isGlobal: false } as any);
      mockDiscountRepo.attachCourses.mockResolvedValueOnce({} as any);

      const res = await service.attachCoursesToDiscount('d-1', ['c-1']);
      expect(res.message).toContain('thành công');
      expect(mockDiscountRepo.attachCourses).toHaveBeenCalledWith('d-1', ['c-1']);
    });
  });

  // ==========================================
  // [B] VOUCHERS (Mã giảm giá)
  // ==========================================
  describe('Vouchers Management', () => {
    it('9. Nên lấy danh sách Vouchers', async () => {
      mockVoucherRepo.findVouchers.mockResolvedValueOnce({
        total: 5,
        data: [{ id: 'v-1' }],
      } as any);
      const res = await service.getVouchers({ page: 1 });
      expect(res.data).toHaveLength(1);
    });

    it('10. Nên lấy chi tiết Voucher và nối thêm dữ liệu Stats', async () => {
      (mockVoucherRepo as any).findById.mockResolvedValueOnce({ id: 'v-1' } as any);
      mockVoucherRepo.getVoucherStats.mockResolvedValueOnce({ revenueGenerated: 5000 } as any);

      const res = await service.getVoucherDetail('v-1');
      expect(res.id).toBe('v-1');
      expect(res.stats.revenueGenerated).toBe(5000);
    });

    it('11. Lỗi 409: Tạo Voucher trùng mã Code', async () => {
      mockVoucherRepo.checkCodeExists.mockResolvedValueOnce(true as any); // Báo là đã có
      await expect(service.createVoucher({ code: 'DUP_CODE' } as any)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('12. Lỗi 400: Airdrop (Gift) Voucher cho tệp không phải SPECIFIC_USERS', async () => {
      (mockVoucherRepo as any).findById.mockResolvedValueOnce({ audience: 'ALL_USERS' } as any);
      await expect(service.giftVoucher('v-1', ['u-1'])).rejects.toMatchObject({ statusCode: 400 });
    });

    it('13. Nên Airdrop Voucher thành công cho SPECIFIC_USERS', async () => {
      (mockVoucherRepo as any).findById.mockResolvedValueOnce({
        audience: 'SPECIFIC_USERS',
      } as any);
      mockVoucherRepo.giftVoucherToUsers.mockResolvedValueOnce({ count: 2 } as any);

      const res = await service.giftVoucher('v-1', ['u-1', 'u-2']);
      expect(res.message).toContain('2 người dùng');
    });
  });
});
