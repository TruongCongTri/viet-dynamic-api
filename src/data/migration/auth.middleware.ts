import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/common/configs/env.config'; // Import từ Zod thay vì dùng process.env

// Mở rộng interface Request của Express để chứa thông tin user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  // Lấy token từ HTTP-Only Cookie
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      role: string;
      sessionId: string;
    };
    req.user = decoded;
    next();
    return;
  } catch {
    // Không cần khai báo biến error nếu bạn không dùng nó để log hay xử lý gì
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
};

// Middleware phân quyền Admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Truy cập bị từ chối. Chỉ dành cho Quản trị viên.' });
  }
  next();
  return;
};
