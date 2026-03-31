// import { ENDPOINTS } from "@/constants/endpoints";
import { Router } from 'express';

const studioRoute = Router();
// const studioController = new StudioController();

// studioRoute.get(ENDPOINTS.STUDIO.COURSES, studioController.getMyTaughtCourses);
// studioRoute.post(ENDPOINTS.STUDIO.COURSES, studioController.createCourseDraft);
// // Curriculum
// studioRoute.post(ENDPOINTS.STUDIO.MODULES, checkCourseOwnership, studioController.addModule);
// studioRoute.get(ENDPOINTS.STUDIO.UPLOAD_URL, checkCourseOwnership, studioController.getPresignedUrl);
// // Webhook Cloudflare (Gắn ở đây hoặc Public tùy chiến lược)
// studioRoute.post('/webhooks/cloudflare', studioController.handleVideoEncoding);

export default studioRoute;
