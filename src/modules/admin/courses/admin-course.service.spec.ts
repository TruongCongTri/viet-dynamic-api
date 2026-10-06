import { AdminCourseService } from './admin-course.service';
import { AdminCourseRepository } from './admin-course.repository';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('./admin-course.repository');

describe('AdminCourseService (Unit Tests)', () => {
  let service: AdminCourseService;
  let mockRepo: jest.Mocked<AdminCourseRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new AdminCourseRepository() as jest.Mocked<AdminCourseRepository>;
    service = new AdminCourseService();
    (service as any).adminCourseRepo = mockRepo;
  });

  // ==========================================
  // [A] CATEGORIES (Danh mục)
  // ==========================================
  describe('Category Management', () => {
    it('1. Nên trả về danh sách Category', async () => {
      mockRepo.getCategories.mockResolvedValueOnce([{ id: 'cat-1', name: 'IT' }] as any);
      const res = await service.getCategories();
      expect(res).toHaveLength(1);
    });

    it('2. Nên tạo mới Category thành công', async () => {
      mockRepo.createCategory.mockResolvedValueOnce({ id: 'cat-2' } as any);
      const res = await service.createCategory({ name: 'Design' });
      expect(res.id).toBe('cat-2');
    });

    it('3. Nên cập nhật Category thành công', async () => {
      mockRepo.updateCategory.mockResolvedValueOnce({ id: 'cat-1', name: 'IT Pro' } as any);
      const res = await service.updateCategory('cat-1', { name: 'IT Pro' });
      expect(res.name).toBe('IT Pro');
    });

    it('4. Nên xóa Category và trả về thông báo', async () => {
      mockRepo.deleteCategory.mockResolvedValueOnce({} as any);
      const res = await service.deleteCategory('cat-1');
      expect(res.message).toContain('Đã xóa');
    });
  });

  // ==========================================
  // [B] COURSE MODERATION (Kiểm duyệt)
  // ==========================================
  describe('Course Moderation', () => {
    it('5. Nên lấy danh sách Khóa học kèm phân trang (Có meta)', async () => {
      mockRepo.findCourses.mockResolvedValueOnce({ total: 10, data: [{ id: 'course-1' }] } as any);
      const res = await service.getCourses({ page: 1, limit: 5 });

      expect(res.data).toHaveLength(1);
      expect(res.meta).toBeDefined();
      expect(res.meta.total).toBe(10);
    });

    it('6. Nên lấy chi tiết Khóa học', async () => {
      mockRepo.getCourseDetailForAdmin.mockResolvedValueOnce({
        id: 'course-1',
        title: 'React',
      } as any);
      const res = await service.getCourseDetail('course-1');
      expect(res.title).toBe('React');
    });

    it('7. Nên ném lỗi 404 nếu lấy chi tiết Khóa học không tồn tại', async () => {
      mockRepo.getCourseDetailForAdmin.mockResolvedValueOnce(null);
      await expect(service.getCourseDetail('ghost')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('8. Nên PHÊ DUYỆT (Approve) khóa học thành công', async () => {
      mockRepo.updateCourseStatus.mockResolvedValueOnce({} as any);
      const res = await service.approveCourse('course-1');
      expect(res.message).toContain('PHÊ DUYỆT');
      expect(mockRepo.updateCourseStatus).toHaveBeenCalledWith('course-1', 'PUBLISHED');
    });

    it('9. Nên TỪ CHỐI (Reject) khóa học kèm lý do', async () => {
      mockRepo.updateCourseStatus.mockResolvedValueOnce({} as any);
      const res = await service.rejectCourse('course-1', 'Nội dung sơ sài');
      expect(res.message).toContain('từ chối');
      expect(mockRepo.updateCourseStatus).toHaveBeenCalledWith(
        'course-1',
        'REJECTED',
        'Nội dung sơ sài'
      );
    });

    it('10. Nên KÉO SẬP (Takedown) khóa học', async () => {
      mockRepo.updateCourseStatus.mockResolvedValueOnce({} as any);
      const res = await service.takedownCourse('course-1');
      expect(res.message).toContain('KÉO SẬP');
      expect(mockRepo.updateCourseStatus).toHaveBeenCalledWith('course-1', 'HIDDEN');
    });
  });

  // ==========================================
  // [C] INSTRUCTOR ASSIGNMENT & REVIEWS
  // ==========================================
  describe('Instructor & Reviews Management', () => {
    it('11. Nên lấy danh sách Giảng viên', async () => {
      mockRepo.getInstructorList.mockResolvedValueOnce([{ id: 'inst-1' }] as any);
      const res = await service.getInstructorList();
      expect(res).toHaveLength(1);
    });

    it('12. Lỗi 400 (Edge Case): Tổng Revenue Share !== 100%', async () => {
      const payload = [
        { isOwner: true, revenueShare: 50 },
        { isOwner: false, revenueShare: 40 },
      ]; // Tổng 90
      await expect(service.assignInstructors('c1', payload)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('100%'),
      });
    });

    it('13. Lỗi 400 (Edge Case): Không có hoặc có hơn 1 Owner', async () => {
      const payloadZeroOwner = [{ isOwner: false, revenueShare: 100 }];
      const payloadTwoOwners = [
        { isOwner: true, revenueShare: 50 },
        { isOwner: true, revenueShare: 50 },
      ];

      await expect(service.assignInstructors('c1', payloadZeroOwner)).rejects.toMatchObject({
        statusCode: 400,
      });
      await expect(service.assignInstructors('c1', payloadTwoOwners)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('14. Phân công Giảng viên hợp lệ (1 Owner, tổng 100%)', async () => {
      mockRepo.assignInstructors.mockResolvedValueOnce({} as any);
      const payload = [
        { isOwner: true, revenueShare: 70 },
        { isOwner: false, revenueShare: 30 },
      ];

      const res = await service.assignInstructors('c1', payload);
      expect(res.message).toContain('thành công');
      expect(mockRepo.assignInstructors).toHaveBeenCalledWith('c1', payload);
    });

    it('15. Nên lấy danh sách Review kèm phân trang', async () => {
      mockRepo.getReviews.mockResolvedValueOnce({ total: 10, data: [{ id: 'rev-1' }] } as any);
      const res = await service.getReviews({ page: 1 });
      expect(res.data).toHaveLength(1);
      expect(res.meta).toBeDefined();
    });

    it('16. Lỗi 404: Xóa Review không tồn tại', async () => {
      mockRepo.deleteReview.mockRejectedValueOnce(new Error('Not found'));
      await expect(service.deleteReview('ghost')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('17. Xóa Review thành công', async () => {
      mockRepo.deleteReview.mockResolvedValueOnce({} as any);
      const res = await service.deleteReview('rev-1');
      expect(res.message).toContain('Đã xóa');
    });
  });
});
