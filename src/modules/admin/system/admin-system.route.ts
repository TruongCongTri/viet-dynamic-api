import { Router } from 'express';
import { AdminSystemController } from './admin-system.controller';
import { validate } from '@/middlewares/validate.middleware';
import { verifyToken, requireRole } from '@/middlewares/auth.middleware';
import {
  createForbiddenWordSchema,
  createRoleSchema,
  paramIdSchema,
  updateRolePermissionsSchema,
} from './admin-system.schema';

export class AdminSystemRoute {
  public router: Router;
  private readonly controller: AdminSystemController;

  constructor() {
    this.router = Router();
    this.controller = new AdminSystemController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // API Health Check mở Public (để cho AWS Route53 / Docker kiểm tra mạng)
    this.router.get('/health', this.controller.getSystemHealth);

    // CÁC API CÒN LẠI YÊU CẦU QUYỀN ADMIN TỐI CAO
    this.router.use(verifyToken, requireRole(['ADMIN']));

    // --- FORBIDDEN WORDS ---
    this.router.get('/forbidden-words', this.controller.getForbiddenWords);
    this.router.post(
      '/forbidden-words',
      validate(createForbiddenWordSchema),
      this.controller.addForbiddenWord
    );
    this.router.delete(
      '/forbidden-words/:id',
      validate(paramIdSchema),
      this.controller.removeForbiddenWord
    );

    // --- ROLES & PERMISSIONS ---
    this.router.get('/roles', this.controller.getRolesAndPermissions);
    this.router.post('/roles', validate(createRoleSchema), this.controller.createRole);
    this.router.put(
      '/roles/:id/permissions',
      validate(paramIdSchema),
      validate(updateRolePermissionsSchema),
      this.controller.updateRolePermissions
    );
  }
}

export default new AdminSystemRoute().router;
