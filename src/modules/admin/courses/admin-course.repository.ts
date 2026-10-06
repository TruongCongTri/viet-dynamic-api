import { prisma } from '@/common/configs/prisma.config';
import { Course, Prisma } from '@prisma/client';
import { BaseRepository } from '@/common/repositories/base.repository';
import { slugify } from '@/common/utils/slugify.util';

export class AdminCourseRepository extends BaseRepository<Course> {
  constructor() {
    super('course');
  }

  // ==========================================
  // [A] DANH MỤC (CATEGORIES)
  // ==========================================
  public async getCategories() {
    return prisma.category.findMany({
      include: {
        _count: { select: { courses: true } }, // Đếm số khóa học trong danh mục
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async createCategory(data: any) {
    const slug = slugify(data.name);
    return prisma.category.create({ data: { ...data, slug } });
  }

  public async updateCategory(id: string, data: any) {
    const updateData = { ...data };
    if (data.name) updateData.slug = slugify(data.name);
    return prisma.category.update({ where: { id }, data: updateData });
  }

  public async deleteCategory(id: string) {
    // Xóa danh mục an toàn. Các khóa học thuộc danh mục này sẽ bị set categoryId = null (Nếu config schema là SetNull)
    return prisma.category.delete({ where: { id } });
  }

  // ==========================================
  // [B] KIỂM DUYỆT KHÓA HỌC
  // ==========================================
  public async findCourses(params: any) {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.executePagination<any>({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: { select: { name: true } },
        instructors: { include: { user: { select: { profile: { select: { fullName: true } } } } } },
      },
    });
  }

  public async getCourseDetailForAdmin(id: string) {
    return this.findById(id, {
      include: {
        category: true,
        instructors: { include: { user: { select: { email: true, profile: true } } } },
        modules: { include: { lessons: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  // Đổi trạng thái khóa học (Duyệt / Từ chối / Kéo sập)
  public async updateCourseStatus(id: string, status: any, reason?: string) {
    return this.model.update({
      where: { id },
      data: {
        status,
        rejectionReason: reason || null, // Gán null nếu Approve/Takedown
      },
    });
  }

  // ==========================================
  // [C] PHÂN QUYỀN GIẢNG VIÊN & ĂN CHIA DOANH THU
  // ==========================================
  public async getInstructorList() {
    return prisma.user.findMany({
      where: { role: { name: 'INSTRUCTOR' }, isActive: true },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    });
  }

  public async assignInstructors(courseId: string, instructors: any[]) {
    // Xóa toàn bộ giảng viên cũ và nạp danh sách mới bằng Transaction
    return prisma.$transaction(async (tx) => {
      await tx.courseInstructor.deleteMany({ where: { courseId } });
      await tx.courseInstructor.createMany({
        data: instructors.map((instructor) => ({
          courseId,
          userId: instructor.userId,
          isOwner: instructor.isOwner,
          revenueShare: instructor.revenueShare,
        })),
      });
    });
  }

  // ==========================================
  // [D] Quản lý UGC
  // ==========================================
  public async getReviews(params: any) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    return this.executePagination<any>(
      {
        where: {},
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, profile: { select: { fullName: true } } } },
          course: { select: { title: true } },
        },
      },
      prisma.courseReview
    ); // Dùng parameter thứ 2 để override target model trong BaseRepository
  }

  public async deleteReview(id: string) {
    return prisma.courseReview.delete({ where: { id } });
  }
}
