import { Request, Response } from 'express';
import { LearnService } from './learn.service';
import { successResponse } from '@/common/utils/responses/api-response';

import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';

import { CreateCommentDTO, CreateReviewDTO, UpdateProgressDTO } from './learn.schema';

export class LearnController {
  private readonly learnService: LearnService;

  constructor() {
    this.learnService = new LearnService();
  }

  // [A] BẢNG ĐIỀU KHIỂN HỌC TẬP
  public getMyCourses = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const courses = await this.learnService.getMyCourses(userId);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.COURSE),
      data: courses,
    });
  };

  public resumeCourse = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const slug = req.params.slug as string;

    const resumeData = await this.learnService.resumeCourse(userId, slug);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.CONTINUE_LEARNING),
      data: resumeData,
    });
  };

  // [B] TRÌNH PHÁT VIDEO & NỘI DUNG
  public getCourseContent = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const slug = req.params.slug as string;

    const syllabus = await this.learnService.getCourseSyllabus(userId, slug);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.COURSE_CONTENT),
      data: syllabus,
    });
  };

  public getLessonDetail = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const lessonId = req.params.lessonId as string;

    const lessonDetail = await this.learnService.getLessonDetail(userId, lessonId);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.LESSON_CONTENT),
      data: lessonDetail,
    });
  };

  public updateProgress = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const lessonId = req.params.lessonId as string;

    // Gán type DTO để TypeScript tự động nhắc code (Autocomplete)
    const payload = req.body as UpdateProgressDTO;

    const progress = await this.learnService.updateProgress(userId, lessonId, payload);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.UPDATED(RESOURCES.PROGRESS),
      data: progress,
    });
  };

  // [C] TƯƠNG TÁC & CỘNG ĐỒNG
  public getComments = async (req: Request, res: Response) => {
    const lessonId = req.params.lessonId as string;
    const comments = await this.learnService.getComments(lessonId);

    successResponse(res, {
      statusCode: 200,
      message: MESSAGES.COMMON.SUCCESS.FETCHED(RESOURCES.COMMENT),
      data: comments,
    });
  };

  public createComment = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const lessonId = req.params.lessonId as string;
    const payload = req.body as CreateCommentDTO;

    const comment = await this.learnService.createComment(userId, lessonId, payload);

    successResponse(res, {
      statusCode: 201,
      message: MESSAGES.COMMON.SUCCESS.CREATED(RESOURCES.COMMENT),
      data: comment,
    });
  };

  public createReview = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const slug = req.params.slug as string;
    const payload = req.body as CreateReviewDTO;

    const review = await this.learnService.createReview(userId, slug, payload);

    successResponse(res, {
      statusCode: 201,
      message: MESSAGES.COMMON.SUCCESS.CREATED(RESOURCES.REVIEW),
      data: review,
    });
  };
}
