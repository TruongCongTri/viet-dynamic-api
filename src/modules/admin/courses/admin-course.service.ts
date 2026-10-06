import { AdminCourseRepository } from './admin-course.repository';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { PaginationMetaDto } from '@/data/dtos/pagination.dto';

export class AdminCourseService {
  private readonly adminCourseRepo: AdminCourseRepository;

  constructor() {
    this.adminCourseRepo = new AdminCourseRepository();
  }

  // --- CATEGORIES ---
  public async getCategories() {
    return this.adminCourseRepo.getCategories();
  }

  public async createCategory(data: any) {
    return this.adminCourseRepo.createCategory(data);
  }

  public async updateCategory(id: string, data: any) {
    return this.adminCourseRepo.updateCategory(id, data);
  }

  public async deleteCategory(id: string) {
    await this.adminCourseRepo.deleteCategory(id);
    return { message: 'Đã xóa danh mục.' };
  }

  // --- COURSE MODERATION ---
  public async getCourses(query: any) {
    const { total, data } = await this.adminCourseRepo.findCourses(query);
    const meta = PaginationMetaDto.create(query.page || 1, query.limit || 20, total);
    return { data, meta };
  }

  public async getCourseDetail(id: string) {
    const course = await this.adminCourseRepo.getCourseDetailForAdmin(id);
    if (!course)
      throw new AppError(404, 'Khóa học không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    return course;
  }

  public async approveCourse(id: string) {
    // TODO: (Tương lai) Có thể check xem khóa học có ít nhất 1 bài giảng không trước khi duyệt
    await this.adminCourseRepo.updateCourseStatus(id, 'PUBLISHED');
    // Gửi email báo hỉ cho giảng viên ở đây
    return { message: 'Khóa học đã được PHÊ DUYỆT và xuất bản lên hệ thống.' };
  }

  public async rejectCourse(id: string, reason: string) {
    await this.adminCourseRepo.updateCourseStatus(id, 'REJECTED', reason);
    // Gửi email báo lỗi kèm lý do cho giảng viên ở đây
    return { message: 'Đã từ chối khóa học và gửi thông báo cho giảng viên.' };
  }

  public async takedownCourse(id: string) {
    await this.adminCourseRepo.updateCourseStatus(id, 'HIDDEN');
    return { message: 'Đã KÉO SẬP (ẩn) khóa học khỏi hệ thống thành công.' };
  }

  // --- INSTRUCTOR ASSIGNMENT ---
  public async getInstructorList() {
    return this.adminCourseRepo.getInstructorList();
  }

  public async assignInstructors(courseId: string, instructors: any[]) {
    // Validate tổng revenueShare = 100%
    const totalShare = instructors.reduce((acc, curr) => acc + curr.revenueShare, 0);
    if (totalShare !== 100) {
      throw new AppError(
        400,
        `Tổng tỷ lệ ăn chia phải đúng 100%. Hiện tại: ${totalShare}%`,
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    const ownerCount = instructors.filter((i) => i.isOwner).length;
    if (ownerCount !== 1) {
      throw new AppError(
        400,
        'Phải có chính xác 1 giảng viên được đánh dấu là Chủ sở hữu (isOwner = true).',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    await this.adminCourseRepo.assignInstructors(courseId, instructors);
    return { message: 'Phân quyền giảng viên và thiết lập tỷ lệ ăn chia thành công.' };
  }

  public async getReviews(query: Record<string, any>) {
    const { total, data } = await this.adminCourseRepo.getReviews(query);
    const meta = PaginationMetaDto.create(
      Number(query.page) || 1,
      Number(query.limit) || 20,
      total
    );
    return { data, meta };
  }

  public async deleteReview(id: string) {
    try {
      await this.adminCourseRepo.deleteReview(id);
      return { message: 'Đã xóa đánh giá vi phạm thành công.' };
    } catch (_error) {
      throw new AppError(404, 'Đánh giá không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    }
  }
}
