import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '@/common/errors/app.error';
import { errorResponse, ValidationErrorDetail } from '../common/utils/responses/api-response';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction // Phải giữ _next dù không dùng để Express nhận diện đây là Error Handler
) => {
  // 1. Xử lý lỗi Zod Validation (Dự phòng nếu lọt qua Route Middleware)
  if (
    err instanceof ZodError ||
    (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError')
  ) {
    const zodError = err as ZodError;

    const validationIssues: z.core.$ZodIssue[] =
      zodError.issues || (err as { errors?: z.core.$ZodIssue[] }).errors || [];

    const formattedErrors: ValidationErrorDetail[] = validationIssues.map(
      (e: z.core.$ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      })
    );

    return errorResponse(res, {
      statusCode: 422,
      message: 'Dữ liệu đầu vào không hợp lệ',
      error_code: 'VALIDATION_ERROR',
      errors: formattedErrors,
    });
  }

  // 2. Xử lý lỗi Nghiệp vụ (AppError từ Service ném ra)
  if (err instanceof AppError) {
    return errorResponse(res, {
      statusCode: err.statusCode,
      message: err.message,
      ...(err.errorCode !== undefined && { error_code: err.errorCode }),
    });
  }

  // 3. Xử lý lỗi Prisma (Tương đương TypeORM QueryFailedError)
  const prismaErr = err as {
    constructor?: { name: string };
    code?: string;
    meta?: { target?: string[] | string };
  };
  if (
    prismaErr?.constructor?.name === 'PrismaClientKnownRequestError' ||
    prismaErr?.code?.startsWith('P')
  ) {
    // Mã P2002: Lỗi trùng lặp dữ liệu (Unique constraint failed)
    if (prismaErr.code === 'P2002') {
      const targetField = (prismaErr.meta?.target as string[])?.join(', ') || 'field';

      return errorResponse(res, {
        statusCode: 409,
        message: `Dữ liệu đã tồn tại. Vi phạm ràng buộc duy nhất trên: ${targetField}`,
        error_code: 'UNIQUE_CONSTRAINT_VIOLATION',
      });
    }

    // Mã P2025: Không tìm thấy record khi Update/Delete
    if (prismaErr.code === 'P2025') {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Không tìm thấy dữ liệu yêu cầu trong hệ thống.',
        error_code: 'RECORD_NOT_FOUND',
      });
    }
  }

  // 4. Xử lý các lỗi Hệ thống không xác định
  return errorResponse(res, {
    statusCode: 500,
    message: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
    error_code: 'INTERNAL_SERVER_ERROR',
  });
};
