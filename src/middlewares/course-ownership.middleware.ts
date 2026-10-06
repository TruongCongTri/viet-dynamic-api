import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/common/configs/prisma.config';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';

export const checkCourseOwnership = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return next(new AppError(401, 'Chưa đăng nhập', ERROR_CODES.COMMON.UNAUTHORIZED));
    }

    // [BẢN VÁ LỖI TAI NẠN undefined]: Dùng optional chaining (?.) để lấy ID an toàn tuyệt đối
    const courseId = req.params?.courseId || req.body?.courseId || req.params?.id;

    if (!courseId) {
      return next(
        new AppError(400, 'Thiếu thông tin ID Khóa học.', ERROR_CODES.COMMON.INVALID_INPUT)
      );
    }

    // [BYPASS]: Nếu là ADMIN hoặc có quyền ngoại lệ MANAGE_ALL_COURSES -> Cho qua luôn!
    // Bắt bao quát trường hợp role là string hoặc object
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name || '';
    const permissions = user.permissions || [];

    if (roleName === 'ADMIN' || permissions.includes('MANAGE_ALL_COURSES')) {
      return next();
    }

    // [KIỂM TRA GIẢNG VIÊN]: Dùng findFirst thay vì findUnique để tránh lỗi văng sập DB do sai Compound Key
    const isOwner = await prisma.courseInstructor.findFirst({
      where: {
        courseId: courseId,
        userId: user.id,
      },
    });

    if (!isOwner) {
      return next(
        new AppError(
          403,
          'Bạn không có quyền thao tác trên khóa học này.',
          ERROR_CODES.COMMON.FORBIDDEN_OWNERSHIP
        )
      );
    }

    // Pass rào cản thành công
    return next();
  } catch (error) {
    return next(error);
  }
};
