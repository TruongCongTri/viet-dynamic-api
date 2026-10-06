import { Router } from 'express';
import { AdminUserController } from './admin-user.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken, requireRole } from '@/middlewares/auth.middleware';
import {
  queryUsersSchema,
  userParamSchema,
  updateRoleSchema,
  updateStatusSchema,
  updatePermissionsSchema,
  manualEnrollmentSchema,
  revokeEnrollmentParamSchema,
} from './admin-user.schema';

export class AdminUserRoute {
  public router: Router;
  private readonly controller: AdminUserController;

  constructor() {
    this.router = Router();
    this.controller = new AdminUserController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // TOÀN BỘ CÁC ROUTE Ở ĐÂY BẮT BUỘC PHẢI LÀ ADMIN
    this.router.use(verifyToken, requireRole(['ADMIN']));

    // A. Truy xuất & Hồ sơ
    this.router.get('/', validate(queryUsersSchema), this.controller.getUsers);
    this.router.get('/:id', validate(userParamSchema), this.controller.getUserDetail);

    // B. Phân quyền & Trạng thái
    this.router.put(
      '/:id/role',
      validate(userParamSchema),
      validate(updateRoleSchema),
      this.controller.changeUserRole
    );
    this.router.put(
      '/:id/status',
      validate(userParamSchema),
      validate(updateStatusSchema),
      this.controller.changeUserStatus
    );
    this.router.put(
      '/:id/permissions',
      validate(userParamSchema),
      validate(updatePermissionsSchema),
      this.controller.overridePermissions
    );

    // C. Can thiệp Hệ thống (Đá session, Kích hoạt khóa học B2B)
    this.router.delete(
      '/:id/sessions',
      validate(userParamSchema),
      this.controller.revokeAllSessions
    );

    this.router.post(
      '/:id/enrollments',
      validate(userParamSchema),
      validate(manualEnrollmentSchema),
      this.controller.enrollCourseB2B
    );
    this.router.delete(
      '/:id/enrollments/:courseId',
      validate(revokeEnrollmentParamSchema),
      this.controller.revokeCourseAccess
    );
  }
}

export default new AdminUserRoute().router;
