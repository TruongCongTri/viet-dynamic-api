import { Request, Response, NextFunction } from 'express';
import { JwtUtil } from '@/common/utils/auth/jwt.util';
import { prisma } from '@/common/configs/prisma';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';

// Mở rộng interface Request của Express để chứa thông tin user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; sessionId: string };
    }
  }
}

// 1. XÁC THỰC TOKEN & KIỂM TRA SESSION (VERIFY TOKEN)
export const verifyToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      throw new AppError(401, MESSAGES.AUTH.ERROR.MISSING_TOKEN, ERROR_CODES.AUTH.MISSING_TOKEN);
    // Lấy token ra
    const token = authHeader.split(' ')[1];

    // Kiểm tra xem token có thực sự tồn tại (khác undefined/rỗng) không
    if (!token)
      throw new AppError(401, MESSAGES.AUTH.ERROR.INVALID_TOKEN, ERROR_CODES.AUTH.INVALID_TOKEN);

    const decoded = JwtUtil.verifyAccessToken(token) as {
      id: string;
      role: string;
      sessionId: string;
    };

    // Kiểm tra xem Session này có bị Admin "Đá văng" (Revoked) chưa?
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || session.isRevoked)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_SESSION,
        ERROR_CODES.AUTH.INVALID_SESSION
      );

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(new AppError(401, MESSAGES.AUTH.ERROR.TOKEN_EXPIRED, ERROR_CODES.AUTH.TOKEN_EXPIRED));
    } else {
      next(new AppError(401, MESSAGES.AUTH.ERROR.INVALID_TOKEN, ERROR_CODES.AUTH.INVALID_TOKEN));
    }
  }
};

// 2. KIỂM TRA VAI TRÒ (REQUIRE ROLE)
// Dùng cho các luồng cơ bản (VD: Chỉ Học viên mới được xem Khóa học của tôi)
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      next(new AppError(403, MESSAGES.MIDDLEWARE.FORBIDDEN, ERROR_CODES.COMMON.FORBIDDEN));
      return;
    }
    next();
  };
};

//
// 3. KIỂM TRA QUYỀN HẠN HOẠT ĐỘNG (REQUIRE PERMISSION)
// Kiểm tra cả Quyền gốc (Role) VÀ Quyền ngoại lệ (Extra Permissions)
export const requirePermission = (requiredAction: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user)
        throw new AppError(
          401,
          MESSAGES.AUTH.ERROR.UNAUTHENTICATED,
          ERROR_CODES.AUTH.UNAUTHENTICATED
        );

      // Query nhanh vào DB để check xem user này CÓ quyền này không (Không cần fetch toàn bộ User)
      const userWithPermissions = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          role: {
            select: {
              permissions: {
                where: { permission: { action: requiredAction } },
                take: 1,
              },
            },
          },
          extraPermissions: {
            where: { permission: { action: requiredAction } },
            take: 1,
          },
        },
      });

      if (!userWithPermissions)
        throw new AppError(
          401,
          MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.USER),
          ERROR_CODES.AUTH.USER_NOT_FOUND
        );

      // Check xem Quyền có nằm trong Role hoặc nằm trong Extra Permissions không
      const hasRolePermission = userWithPermissions.role.permissions.length > 0;
      const hasExtraPermission = userWithPermissions.extraPermissions.length > 0;

      if (!hasRolePermission && !hasExtraPermission) {
        throw new AppError(
          403,
          MESSAGES.MIDDLEWARE.MISSING_PERMISSION(requiredAction),
          ERROR_CODES.COMMON.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// 4. REQUIRE OWNERSHIP (Kiểm tra sở hữu tài nguyên)
// paramKey là tên của tham số truyền trên URL (VD: req.params.userId)
export const requireOwnership = (paramKey: string = 'id') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError(401, MESSAGES.AUTH.ERROR.UNAUTHENTICATED, ERROR_CODES.AUTH.UNAUTHENTICATED)
      );
      return;
    }

    const resourceUserId = req.params[paramKey];

    // Nếu là Admin hoặc là Chủ sở hữu tài nguyên -> Cho đi tiếp
    if (req.user.role === 'ADMIN' || req.user.id === resourceUserId) {
      next();
    } else {
      next(
        new AppError(
          403,
          MESSAGES.MIDDLEWARE.FORBIDDEN_OWNERSHIP,
          ERROR_CODES.COMMON.FORBIDDEN_OWNERSHIP
        )
      );
    }
  };
};
