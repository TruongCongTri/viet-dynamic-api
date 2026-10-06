import { checkCourseOwnership } from './course-ownership.middleware';
import { prisma } from '../common/configs/prisma.config';
import { Request, Response, NextFunction } from 'express';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/common/configs/prisma.config', () => ({
  prisma: {
    courseInstructor: { findUnique: jest.fn(), findFirst: jest.fn() },
    course: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));

describe('CourseOwnership Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      params: { id: 'course-1', courseId: 'course-1' },
      user: { id: 'user-1', role: 'INSTRUCTOR' } as any,
    };
    mockResponse = {};
    nextFunction = jest.fn();
  });

  it('1. Nên cho phép ADMIN đi qua (Bypass) mà không cần check DB', async () => {
    mockRequest.user!.role = { name: 'ADMIN' } as any;

    await checkCourseOwnership(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(prisma.courseInstructor.findUnique).not.toHaveBeenCalled();
    expect(nextFunction).toHaveBeenCalledTimes(1);
  });

  it('2. Nên chặn lại (Lỗi 403) nếu Giảng viên không sở hữu khóa học', async () => {
    // Trả về null cho mọi thể loại truy vấn DB
    (prisma.courseInstructor.findUnique as jest.Mock<any>).mockResolvedValueOnce(null);
    (prisma.courseInstructor.findFirst as jest.Mock<any>).mockResolvedValueOnce(null);
    (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce(null);

    await checkCourseOwnership(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction as NextFunction
    );

    // Middleware chuẩn Express sẽ gọi next(error) thay vì throw thẳng
    expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));

    // Kiểm tra xem lỗi ném vào next() có đúng là 403 không
    const errorArg = (nextFunction as jest.Mock).mock.calls[0][0] as any;
    expect(errorArg.statusCode).toBe(403);
  });

  it('3. Nên cho phép Giảng viên đi qua nếu DB xác nhận quyền sở hữu', async () => {
    const mockValidData = { courseId: 'course-1', userId: 'user-1' };

    // Trả về dữ liệu hợp lệ cho mọi thể loại truy vấn
    (prisma.courseInstructor.findUnique as jest.Mock<any>).mockResolvedValueOnce(mockValidData);
    (prisma.courseInstructor.findFirst as jest.Mock<any>).mockResolvedValueOnce(mockValidData);
    (prisma.course.findUnique as jest.Mock<any>).mockResolvedValueOnce({
      instructors: [mockValidData],
    });

    await checkCourseOwnership(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction as NextFunction
    );

    // Kiểm tra xem next có được gọi trơn tru không (không bị nhét biến error vào)
    expect(nextFunction).toHaveBeenCalledWith();
    expect(nextFunction).toHaveBeenCalledTimes(1);
  });
});
