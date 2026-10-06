import { Router } from 'express';
import { ENDPOINTS } from '../../constants/endpoints';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware';

// 📦 Import Route từ các Feature Modules
import authRoute from '../../modules/auth/auth.route';
import publicRoute from '../../modules/public/public.route';
import userRoute from '../../modules/user/user.route';
import commerceRoute from '../../modules/commerce/commerce.route';
import learnRoute from '../../modules/learn/learn.route';
import studioRoute from '../../modules/studio/studio.route';
import adminRoute from '../../modules/admin/admin.route';
import { StudioController } from '@/modules/studio/studio.controller';

const v1Router = Router();
const studioController = new StudioController();

// 1. PUBLIC ROUTES (Đặt lên trên cùng, đảm bảo KHÔNG dính middleware bảo mật nào)
v1Router.use(ENDPOINTS.PUBLIC.BASE, publicRoute);
v1Router.use(ENDPOINTS.AUTH.BASE, authRoute);

v1Router.post('/webhooks/cloudflare', studioController.processCloudflareWebhook);

// v1Router.use(ENDPOINTS.STUDIO.BASE, verifyToken, requireRole(['INSTRUCTOR', 'ADMIN']), studioRoute);
v1Router.use(ENDPOINTS.STUDIO.BASE, studioRoute);

v1Router.use(ENDPOINTS.USER.BASE, verifyToken, userRoute);
v1Router.use(ENDPOINTS.COMMERCE.BASE, verifyToken, commerceRoute);
v1Router.use(
  ENDPOINTS.LEARN.BASE,
  verifyToken,
  requireRole(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
  learnRoute
);
// v1Router.use(ENDPOINTS.ADMIN.BASE, verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), adminRoute);
v1Router.use(ENDPOINTS.ADMIN.BASE, adminRoute);

export default v1Router;
