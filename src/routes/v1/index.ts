import { Router } from 'express';
import { ENDPOINTS } from '../../constants/endpoints';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware';

// 📦 Import Route từ các Feature Modules
import authRoute from '../../modules/auth/auth.route';
import userRoute from '../../modules/user/user.route';
import commerceRoute from '../../modules/commerce/commerce.route';
import learnRoute from '../../modules/learn/learn.route';
import studioRoute from '../../modules/studio/studio.route';
import adminRoute from '../../modules/admin/admin.route';

const v1Router = Router();

// ==========================================
// 🟢 PUBLIC & AUTHENTICATION
// ==========================================
v1Router.use(ENDPOINTS.AUTH.BASE, authRoute);

// User Profile (Cần login)
v1Router.use(ENDPOINTS.USER.BASE, verifyToken, userRoute);

// ==========================================
// 🔵 USER & COMMERCE (Cần đăng nhập)
// ==========================================
v1Router.use(ENDPOINTS.COMMERCE.BASE, verifyToken, commerceRoute);

// ==========================================
// 🟣 LEARNING SPACE (Cần Role Học viên/Giảng viên/Admin)
// ==========================================
v1Router.use(
  ENDPOINTS.LEARN.BASE,
  verifyToken,
  requireRole(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
  learnRoute
);

// ==========================================
// 🎙️ INSTRUCTOR STUDIO (Cần Role Giảng viên/Admin)
// ==========================================
v1Router.use(ENDPOINTS.STUDIO.BASE, verifyToken, requireRole(['INSTRUCTOR', 'ADMIN']), studioRoute);

// ==========================================
// 👑 ADMIN PANEL (Chỉ Admin)
// ==========================================
v1Router.use(ENDPOINTS.ADMIN.BASE, verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), adminRoute);

export default v1Router;
