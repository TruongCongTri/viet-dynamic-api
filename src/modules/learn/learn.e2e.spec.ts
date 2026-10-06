import request from 'supertest';
import app from '../../app';
import { prisma } from '../../common/configs/prisma.config';
import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Learn API (E2E Tests - Full Coverage)', () => {
  const studentData = {
    email: 'student-learn@ex.com',
    password: 'Password123!',
    fullName: 'Learn Student',
  };

  const guestData = {
    email: 'guest-learn@ex.com',
    password: 'Password123!',
    fullName: 'Guest Student',
  };

  let accessToken: string;
  let guestToken: string;
  let studentId: string;
  let testCourseId: string;
  let testLessonId: string;
  let testCommentId: string;

  beforeAll(async () => {
    // 1. Dọn dẹp DB
    await prisma.user.deleteMany({ where: { email: studentData.email } });
    await prisma.course.deleteMany({ where: { slug: 'e2e-learn-course' } });

    // 2.a. Tạo Guest Student & Lấy Token
    await request(app).post('/api/v1/auth/register').send(guestData);
    const guestUser = await prisma.user.findUnique({ where: { email: guestData.email } });
    await prisma.user.update({ where: { id: guestUser!.id }, data: { accountStatus: 'APPROVED' } });

    const guestLogin = await request(app).post('/api/v1/auth/login').send({
      email: guestData.email,
      password: guestData.password,
    });
    guestToken = guestLogin.body.data.accessToken;

    // 2.b. Tạo User & Lấy Token
    const registerRes = await request(app).post('/api/v1/auth/register').send(studentData);
    studentId = registerRes.body.data.id;
    await prisma.user.update({ where: { id: studentId }, data: { accountStatus: 'APPROVED' } });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: studentData.email,
      password: studentData.password,
    });
    accessToken = loginRes.body.data.accessToken;

    // 3. Chuẩn bị dữ liệu khóa học
    const instructor =
      (await prisma.user.findFirst({ where: { role: { name: 'INSTRUCTOR' } } })) ||
      (await prisma.user.create({
        data: {
          email: 'inst-learn@ex.com',
          password: '123',
          profile: { create: { fullName: 'Inst' } },
          role: { connect: { name: 'INSTRUCTOR' } },
        },
      }));

    // ÉP PRISMA DÙNG UUID CHUẨN ĐỂ VƯỢT QUA ZOD VALIDATION
    const forcedLessonUuid = crypto.randomUUID();

    const course = await prisma.course.create({
      data: {
        title: 'E2E Learn Course',
        slug: 'e2e-learn-course',
        instructors: {
          create: { userId: instructor.id, isOwner: true },
        },
        basePrice: 0,
        status: 'PUBLISHED',
        modules: {
          create: {
            title: 'Module 1',
            order: 1,
            lessons: {
              create: {
                id: forcedLessonUuid, // Bơm UUID xịn vào đây
                title: 'Lesson 1',
                type: 'VIDEO',
                duration: 100,
                order: 1,
                isPreview: false,
              },
            },
          },
        },
      },
      include: { modules: { include: { lessons: true } } },
    });

    testCourseId = course.id;
    testLessonId = forcedLessonUuid;

    // 4. Ghi danh (Enrollment) cho học viên
    await prisma.enrollment.create({
      data: { userId: studentId, courseId: testCourseId },
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.lessonComment.deleteMany({ where: { userId: studentId } });
    await prisma.course.deleteMany({ where: { id: testCourseId } });
    await prisma.user.deleteMany({ where: { email: studentData.email } });
    await prisma.$disconnect();
  });

  // ==========================================
  // [A] BẢNG ĐIỀU KHIỂN & NỘI DUNG
  // ==========================================
  describe('GET /api/v1/learn/my-courses', () => {
    it('1. Nên trả về danh sách khóa học đang học', async () => {
      const response = await request(app)
        .get('/api/v1/learn/my-courses')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].slug).toBe('e2e-learn-course');
      expect(response.body.data[0].totalLessons).toBe(1);
    });
  });

  describe('GET /api/v1/learn/courses/:slug/resume', () => {
    it('2. Nên trả về lesson ID đầu tiên để học tiếp', async () => {
      const response = await request(app)
        .get('/api/v1/learn/courses/e2e-learn-course/resume')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.lessonId).toBe(testLessonId);
    });
  });

  // Test API lấy Syllabus khóa học (Video Player Header/Sidebar)
  describe('GET /api/v1/learn/courses/:slug', () => {
    it('2.1. Nên lấy được nội dung (Syllabus) của khóa học', async () => {
      const response = await request(app)
        .get('/api/v1/learn/courses/e2e-learn-course')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.slug).toBe('e2e-learn-course');
      expect(response.body.data.title).toBe('E2E Learn Course');
    });
  });

  describe('GET /api/v1/learn/lessons/:id', () => {
    it('3. Nên lấy được chi tiết bài học và cấp Token Video', async () => {
      const response = await request(app)
        .get(`/api/v1/learn/lessons/${testLessonId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('Lesson 1');
      // Các trường bí mật phải bị cắt đi
      expect(response.body.data.videoId).toBeUndefined();
      expect(response.body.data.videoUrl).toBeUndefined();
    });

    it('3.1. Nên chặn truy cập (Lỗi 403) nếu Học viên CHƯA MUA khóa học này', async () => {
      const response = await request(app)
        .get(`/api/v1/learn/lessons/${testLessonId}`)
        // [QUAN TRỌNG]: Dùng token của người chưa mua khóa học
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
      // expect(response.body.message).toContain('Bạn phải sở hữu khóa học này');
    });
  });

  describe('PUT /api/v1/learn/lessons/:id/progress', () => {
    it('4. Nên cập nhật tiến độ và tự động hoàn thành nếu xem >= 90%', async () => {
      // Bài học giả lập dài 100s. Gửi 95s (95%)
      const response = await request(app)
        .put(`/api/v1/learn/lessons/${testLessonId}/progress`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ watchedSeconds: 95 });

      expect(response.status).toBe(200);
      expect(response.body.data.isCompleted).toBe(true); // Đã bị Heartbeat Threshold kích hoạt
      expect(response.body.data.courseProgressPercent).toBe(100); // Hoàn thành 1/1 bài = 100%
    });
  });

  // ==========================================
  // [B] TƯƠNG TÁC (COMMENTS)
  // ==========================================
  describe('POST & GET /api/v1/learn/lessons/:id/comments', () => {
    it('5. Nên đăng bình luận thành công', async () => {
      const response = await request(app)
        .post(`/api/v1/learn/lessons/${testLessonId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Bài học rất hay!' });

      expect(response.status).toBe(201);
      testCommentId = response.body.data.id;
    });

    it('6. Nên lấy được danh sách bình luận của bài học', async () => {
      const response = await request(app)
        .get(`/api/v1/learn/lessons/${testLessonId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].content).toBe('Bài học rất hay!');
      expect(response.body.data[0].isAuthor).toBe(false); // Học viên nên không có hào quang
    });
  });

  describe('PUT & DELETE /api/v1/learn/comments/:commentId', () => {
    it('7. Nên sửa bình luận thành công', async () => {
      const response = await request(app)
        .put(`/api/v1/learn/comments/${testCommentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Bài học quá xuất sắc!' });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('Bài học quá xuất sắc!');
    });

    it('8. Nên xóa bình luận thành công', async () => {
      const response = await request(app)
        .delete(`/api/v1/learn/comments/${testCommentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ==========================================
  // [C] ĐÁNH GIÁ (REVIEWS)
  // ==========================================
  describe('POST /api/v1/learn/courses/:slug/reviews', () => {
    it('9. Nên đăng đánh giá khóa học thành công (Vì tiến độ đã đạt 100% ở test case 4)', async () => {
      const response = await request(app)
        .post('/api/v1/learn/courses/e2e-learn-course/reviews')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rating: 5, content: 'Chất lượng tuyệt vời!' });

      expect(response.status).toBe(201);
      expect(response.body.data.rating).toBe(5);
    });
  });
});
