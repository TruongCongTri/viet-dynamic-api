import { Router } from 'express';
// import { ENDPOINTS } from '../../constants/endpoints';
// import { adminUserController } from './admin-user.controller';
// import { adminCourseController } from './admin-course.controller';
// import { adminFinanceController } from './admin-finance.controller';
// import { adminSystemController } from './admin-system.controller';

const adminRoute = Router();

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
