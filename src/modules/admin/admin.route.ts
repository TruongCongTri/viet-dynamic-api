// import { requireRole, verifyToken } from '@/middlewares/auth.middleware';
import { Router } from 'express';
import usersRoute from './users/admin-user.route';
import coursesRoute from './courses/admin-course.route';
import marketingRoute from './marketing/admin-marketing.route';
import financeRoute from './finance/admin-finance.route';
import systemRoute from './system/admin-system.route';

const adminRoute = Router();

// adminRoute.use(verifyToken, requireRole(['ADMIN']));

adminRoute.use('/users', usersRoute);
adminRoute.use('/courses', coursesRoute);
adminRoute.use('/marketing', marketingRoute);
adminRoute.use('/finance', financeRoute);
adminRoute.use('/system', systemRoute);

// --- 2.1 Quản lý Người dùng (User Management) ---
// // Base: /api/v1/admin/users
// adminRoute.get(ENDPOINTS.ADMIN.USERS, adminUserController.getAllUsers);
// adminRoute.get(`${ENDPOINTS.ADMIN.USERS}/:id`, adminUserController.getUserDetail);
// adminRoute.put(`${ENDPOINTS.ADMIN.USERS}/:id/role`, adminUserController.updateUserRole);
// adminRoute.put(`${ENDPOINTS.ADMIN.USERS}/:id/status`, adminUserController.toggleUserStatus);
// adminRoute.delete(`${ENDPOINTS.ADMIN.USERS}/:id/sessions`, adminUserController.kickUserSessions);

// // --- 2.2 Quản lý Nội dung (Course Moderation) ---
// // Base: /api/v1/admin/courses
// adminRoute.get(ENDPOINTS.ADMIN.COURSES, adminCourseController.getAllCourses);
// adminRoute.patch(`${ENDPOINTS.ADMIN.COURSES}/:id/approve`, adminCourseController.approveCourse);
// adminRoute.patch(`${ENDPOINTS.ADMIN.COURSES}/:id/reject`, adminCourseController.rejectCourse);
// adminRoute.patch(`${ENDPOINTS.ADMIN.COURSES}/:id/takedown`, adminCourseController.takedownCourse);

// // --- 2.3 Quản lý Danh mục & Hệ thống ---
// adminRoute.post(ENDPOINTS.ADMIN.CATEGORIES, adminSystemController.createCategory);
// adminRoute.delete(`${ENDPOINTS.ADMIN.CATEGORIES}/:id`, adminSystemController.deleteCategory);

// // Health check & System monitor
// adminRoute.get(`${ENDPOINTS.ADMIN.SYSTEM}/health`, adminSystemController.getSystemHealth);
// adminRoute.get(`${ENDPOINTS.ADMIN.SYSTEM}/roles`, adminSystemController.getRolesAndPermissions);

// // --- 2.4 Tài chính & Đơn hàng (Finance) ---
// // Base: /api/v1/admin/orders
// adminRoute.get(ENDPOINTS.ADMIN.ORDERS, adminFinanceController.getAllOrders);
// adminRoute.post(`${ENDPOINTS.ADMIN.ORDERS}/:id/refund`, adminFinanceController.refundOrder);
// adminRoute.post(`${ENDPOINTS.ADMIN.ORDERS}/:id/query-payment-status`, adminFinanceController.syncPayment);

export default adminRoute;
