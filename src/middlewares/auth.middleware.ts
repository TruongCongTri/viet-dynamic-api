import { Request, Response, NextFunction } from 'express';
import { JwtUtil } from '@/common/utils/auth/jwt.util';
import { prisma } from '@/common/configs/prisma';

// Mở rộng interface Request của Express để chứa thông tin user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; sessionId: string };
    }
  }
}

// ============================================================================
// 1. XÁC THỰC TOKEN & KIỂM TRA SESSION (VERIFY TOKEN)
// ============================================================================
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Không tìm thấy Access Token.' });
      return;
    }

    // Lấy token ra
    const token = authHeader.split(' ')[1];

    // Kiểm tra xem token có thực sự tồn tại (khác undefined/rỗng) không
    if (!token) {
      res.status(401).json({ success: false, message: 'Định dạng Access Token không hợp lệ.' });
      return;
    }

    const decoded = JwtUtil.verifyAccessToken(token) as {
      id: string;
      role: string;
      sessionId: string;
    };

    // [RÀO CẢN BẢO MẬT]: Kiểm tra xem Session này có bị Admin "Đá văng" (Revoked) chưa?
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || session.isRevoked) {
      res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.',
      });
      return;
    }

    // Gắn thông tin vào Request để các Controller/Middleware sau sử dụng
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res
        .status(401)
        .json({ success: false, message: 'Access Token đã hết hạn.', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, message: 'Access Token không hợp lệ.' });
  }
};

// ============================================================================
// 2. KIỂM TRA VAI TRÒ (REQUIRE ROLE)
// Dùng cho các luồng cơ bản (VD: Chỉ Học viên mới được xem Khóa học của tôi)
// ============================================================================
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập tài nguyên này (Sai Vai trò).',
      });
      return;
    }
    next();
  };
};

// ============================================================================
// 3. KIỂM TRA QUYỀN HẠN ĐỘNG (REQUIRE PERMISSION)
// Kiểm tra cả Quyền gốc (Role) VÀ Quyền ngoại lệ (Extra Permissions)
// ============================================================================
export const requirePermission = (requiredAction: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực.' });
        return;
      }

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

      if (!userWithPermissions) {
        res.status(401).json({ success: false, message: 'Tài khoản không tồn tại.' });
        return;
      }

      // Check xem Quyền có nằm trong Role hoặc nằm trong Extra Permissions không
      const hasRolePermission = userWithPermissions.role.permissions.length > 0;
      const hasExtraPermission = userWithPermissions.extraPermissions.length > 0;

      if (!hasRolePermission && !hasExtraPermission) {
        res.status(403).json({
          success: false,
          message: `Truy cập bị từ chối. Bạn thiếu quyền hạn: [${requiredAction}].`,
        });
        return;
      }

      next();
    } catch (_error) {
      res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền hạn hệ thống.' });
    }
  };
};
