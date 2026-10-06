import { Request, Response, NextFunction } from 'express';
import { JwtUtil } from '@/common/utils/auth/jwt.util';
import { prisma } from '@/common/configs/prisma.config';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { MESSAGES } from '@/constants/messages';

// Extend Express Request interface to hold the authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; sessionId: string } | undefined;
    }
  }
}

// 1. VERIFY TOKEN & CHECK SESSION IN DB
export const verifyToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      throw new AppError(401, MESSAGES.AUTH.ERROR.MISSING_TOKEN, ERROR_CODES.AUTH.MISSING_TOKEN);

    // Extract token
    const token = authHeader.split(' ')[1];

    if (!token) {
      console.log(`🕵️ BỊ CHẶN BỞI VERIFYTOKEN TẠI URL: ${req.originalUrl}`);
      throw new AppError(401, MESSAGES.AUTH.ERROR.INVALID_TOKEN, ERROR_CODES.AUTH.INVALID_TOKEN);
    }

    const decoded = JwtUtil.verifyAccessToken(token) as {
      id: string;
      role: string;
      sessionId: string;
    };

    // Check if this specific login session was revoked (e.g. by Admin or remote logout)
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || session.isRevoked)
      throw new AppError(
        401,
        MESSAGES.AUTH.ERROR.INVALID_SESSION,
        ERROR_CODES.AUTH.INVALID_SESSION
      );

    // Attach user payload to request for downstream controllers
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(new AppError(401, MESSAGES.AUTH.ERROR.TOKEN_EXPIRED, ERROR_CODES.AUTH.TOKEN_EXPIRED));
    } else if (error instanceof AppError) {
      // Preserve custom errors thrown inside the try block (like missing token)
      next(error);
    } else {
      next(new AppError(401, MESSAGES.AUTH.ERROR.INVALID_TOKEN, ERROR_CODES.AUTH.INVALID_TOKEN));
    }
  }
};

// 2. OPTIONAL VERIFY TOKEN (For mixed public/private routes like /assets/map)
export const optionalVerifyToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // If no valid auth header format, proceed as a Public Guest
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(' ')[1];

    // If empty token, proceed as Guest
    if (!token) {
      req.user = undefined;
      return next();
    }

    const decoded = JwtUtil.verifyAccessToken(token) as {
      id: string;
      role: string;
      sessionId: string;
    };

    // We still must check if the session was revoked!
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || session.isRevoked) {
      req.user = undefined; // Revoked tokens revert to Guest
    } else {
      req.user = decoded; // Valid session! Attach user data.
    }

    next();
  } catch (_error: any) {
    // If the token is invalid, expired, or tampered with, swallow the error
    // and proceed as a Public Guest.
    req.user = undefined;
    next();
  }
};

// 2. REQUIRE ROLE (Simple RBAC for our current architecture)
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      next(new AppError(403, MESSAGES.MIDDLEWARE.FORBIDDEN, ERROR_CODES.COMMON.FORBIDDEN));
      return;
    }
    next();
  };
};

// 3. REQUIRE OWNERSHIP (Check if User owns resource, or if they are ADMIN)
// paramKey is the URL param containing the owner's ID (e.g., req.params.userId)
export const requireOwnership = (paramKey: string = 'id') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError(401, MESSAGES.AUTH.ERROR.UNAUTHENTICATED, ERROR_CODES.AUTH.UNAUTHENTICATED)
      );
      return;
    }

    const resourceUserId = req.params[paramKey];

    // If Admin OR Resource Owner -> Grant Access
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
