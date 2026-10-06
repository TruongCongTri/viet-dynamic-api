import * as crypto from 'crypto';
import { env } from '@/common/configs/env.config';
import { prisma } from '@/common/configs/prisma.config';
import { PublicRepository } from './public.repository';
import {
  GetCategoriesQueryDTO,
  GetCourseReviewsQueryDTO,
  GetCoursesQueryDTO,
  GetInstructorsQueryDTO,
} from './public.schema';
import { AppError } from '@/common/errors/app.error';
import { MESSAGES } from '@/constants/messages';
import { RESOURCES } from '@/constants/resources';
import { ERROR_CODES } from '@/constants/error-codes';
import { PaginationMetaDto } from '@/data/dtos/pagination.dto';

export class PublicService {
  private readonly publicRepository: PublicRepository;

  constructor() {
    this.publicRepository = new PublicRepository();
  }

  // [A] DANH MỤC (CATEGORIES)
  public async getCategories(query: GetCategoriesQueryDTO) {
    const { total, categories } = await this.publicRepository.getCategories(query);

    const meta = PaginationMetaDto.create(query.page, query.limit, total);

    // Gói meta pagination
    return { data: categories, meta };
  }

  public async getCategoryWithCourses(slug: string, query: GetCoursesQueryDTO) {
    // 1. Lấy thông tin chi tiết danh mục
    const category = await this.publicRepository.getCategoryDetailBySlug(slug);

    if (!category) {
      throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.CATEGORY));
    }

    // 2. Ép cứng categorySlug vào query, rồi gọi lại hàm getCourses có sẵn!
    // Hàm này sẽ tự động lo hết việc Phân trang, Lọc giá, Sắp xếp (SortBy)
    query.categorySlug = category.slug;
    const { total, courses } = await this.publicRepository.getCourses(query);

    // 3. Làm phẳng (Flatten) dữ liệu Giảng viên
    const formattedCourses = courses.map((course) => ({
      ...course,
      instructors: course.instructors.map((inst) => ({
        fullName: inst.user.profile?.fullName || 'Giảng viên ẩn danh',
        avatarUrl: inst.user.profile?.avatarUrl || null,
      })),
    }));

    const meta = PaginationMetaDto.create(query.page, query.limit, total);

    return {
      category,
      courses: formattedCourses, // Chỉ chứa mảng data
      meta,
    };
  }

  // [B] KHÓA HỌC (COURSES)
  public async getCourses(query: GetCoursesQueryDTO) {
    const { total, courses } = await this.publicRepository.getCourses(query);

    // Làm phẳng (Flatten) dữ liệu Instructors để Frontend dễ map
    const formattedCourses = courses.map((course) => ({
      ...course,
      instructors: course.instructors.map((inst) => ({
        fullName: inst.user.profile?.fullName || 'Giảng viên ẩn danh',
        avatarUrl: inst.user.profile?.avatarUrl || null,
      })),
    }));

    const meta = PaginationMetaDto.create(query.page, query.limit, total);

    return {
      data: formattedCourses,
      meta,
    };
  }

  public async getCourseDetail(slug: string) {
    const course = await this.publicRepository.getCourseDetailBySlug(slug);

    if (!course) {
      throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.COURSE));
    }

    // Làm phẳng Instructors
    const formattedInstructors = course.instructors.map((inst) => ({
      id: inst.user.id,
      fullName: inst.user.profile?.fullName || 'Giảng viên ẩn danh',
      avatarUrl: inst.user.profile?.avatarUrl || null,
      bio: inst.user.profile?.bio || '',
    }));

    return {
      ...course,
      instructors: formattedInstructors,
    };
  }

  public async getCourseReviews(slug: string, query: GetCourseReviewsQueryDTO) {
    const { total, reviews } = await this.publicRepository.getCourseReviewsBySlug(slug, query);

    // Làm phẳng data User
    const formattedReviews = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      fullName: r.user.profile?.fullName || 'Học viên ẩn danh',
      avatarUrl: r.user.profile?.avatarUrl || null,
    }));

    const meta = PaginationMetaDto.create(query.page, query.limit, total);

    return {
      reviews: formattedReviews,
      meta,
    };
  }

  // [C] GIẢNG VIÊN (INSTRUCTORS)
  public async getInstructors(query: GetInstructorsQueryDTO) {
    const { total, instructors } = await this.publicRepository.getInstructors(query);
    const meta = PaginationMetaDto.create(query.page, query.limit, total);

    return {
      data: instructors,
      meta,
    };
  }

  public async getInstructorDetail(slug: string, query: GetCoursesQueryDTO) {
    // 1. Lấy thông tin giảng viên
    const instructor = await this.publicRepository.getInstructorDetailBySlug(slug);

    if (!instructor) {
      throw new AppError(404, MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.INSTRUCTOR));
    }

    // 2. Tái sử dụng siêu năng lực của getCourses
    query.instructorSlug = instructor.slug!;
    const { total, courses } = await this.publicRepository.getCourses(query);

    // 3. Làm phẳng dữ liệu
    const formattedCourses = courses.map((course) => ({
      ...course,
      instructors: course.instructors.map((inst) => ({
        fullName: inst.user.profile?.fullName || 'Giảng viên ẩn danh',
        avatarUrl: inst.user.profile?.avatarUrl || null,
      })),
    }));

    const meta = PaginationMetaDto.create(query.page, query.limit, total);

    return {
      instructor, // Thông tin giảng viên
      courses: formattedCourses,
      meta,
    };
  }

  // [D] PAYMENTS (Xử lý Webhook VNPAY)
  public async processVnpayWebhook(payload: Record<string, any>) {
    // Clone payload để không đột biến dữ liệu gốc
    let vnp_Params = { ...payload };
    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    // 1. Sắp xếp Object theo thứ tự Alphabet
    vnp_Params = this.sortObject(vnp_Params);

    // 2. Tạo chuỗi ký (Sign Data) thủ công để tránh bị double-encode bởi URLSearchParams
    const signData = Object.keys(vnp_Params)
      .map((key) => `${key}=${encodeURIComponent(String(vnp_Params[key])).replace(/%20/g, '+')}`)
      .join('&');

    const secretKey = env.VNPAY_HASH_SECRET || process.env.VNPAY_HASH_SECRET || 'e2e-vnpay-secret';
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      throw new AppError(
        400,
        MESSAGES.PAYMENT.ERROR.INVALID_SIGNATURE,
        ERROR_CODES.PAYMENT.INVALID_SIGNATURE
      );
    }

    const paymentId = vnp_Params['vnp_TxnRef'];
    const amount = Number(vnp_Params['vnp_Amount']) / 100; // VNPAY nhân 100
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const providerTransactionId = vnp_Params['vnp_TransactionNo'];

    // 2. Tìm lượt thử thanh toán (Payment Attempt)
    const payment = await this.publicRepository.getPaymentForWebhook(paymentId);
    if (!payment) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.ORDER),
        ERROR_CODES.PAYMENT.ORDER_NOT_FOUND
      );
    }

    const order = payment.order;

    // 3. Kiểm tra số tiền có bị giả mạo không
    if (Number(payment.amount) !== amount) {
      throw new AppError(
        400,
        MESSAGES.PAYMENT.ERROR.INVALID_AMOUNT,
        ERROR_CODES.PAYMENT.INVALID_AMOUNT
      );
    }

    // 4. KIỂM TRA IDEMPOTENCY (Đã xử lý chưa?)
    if (payment.status === 'SUCCESS' || order.status === 'SUCCESS') {
      return { Message: MESSAGES.PAYMENT.SUCCESS.VNPAY_WEBHOOK_PROCESSED, RspCode: '00' };
    }

    // 5. Nếu thanh toán thành công, tiến hành ghi nhận Database
    if (responseCode === '00') {
      await this.publicRepository.updateOrderSuccessTransaction(
        payment.id,
        order.id,
        order.userId,
        providerTransactionId,
        payload
      );
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', webhookPayload: payload },
      });
    }

    return { Message: MESSAGES.PAYMENT.SUCCESS.VNPAY_WEBHOOK_COMPLETED, RspCode: '00' };
  }

  // Hàm Helper cho VNPAY Hash (Bản sạch)
  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    // Chỉ lấy ra keys, sắp xếp Alphabet, không encode lung tung ở bước này
    const keys = Object.keys(obj)
      .filter((key) => Object.prototype.hasOwnProperty.call(obj, key))
      .sort();

    for (const key of keys) {
      // Bỏ qua các giá trị rỗng để tránh nhiễu chuỗi băm
      if (obj[key] !== '' && obj[key] !== undefined && obj[key] !== null) {
        sorted[key] = String(obj[key]);
      }
    }

    return sorted;
  }

  // [E] PAYMENTS (Xử lý Webhook MoMo)
  public async processMomoWebhook(payload: Record<string, any>) {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = payload;

    // 1. Tạo chuỗi ký theo chuẩn MoMo API V2
    const rawSignature = `accessKey=${env.MOMO_ACCESS_KEY}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    // 2. Mã hóa HMAC SHA256 với Secret Key của MoMo
    const hmac = crypto.createHmac('sha256', env.MOMO_SECRET_KEY || '');
    const expectedSignature = hmac.update(Buffer.from(rawSignature, 'utf-8')).digest('hex');

    // 3. So khớp chữ ký
    if (signature !== expectedSignature) {
      throw new AppError(
        400,
        MESSAGES.PAYMENT.ERROR.INVALID_SIGNATURE,
        ERROR_CODES.PAYMENT.INVALID_SIGNATURE
      );
    }

    // 4. Tìm đơn hàng trong DB
    const paymentId = orderId;
    const payment = await this.publicRepository.getPaymentForWebhook(paymentId);

    if (!payment) {
      throw new AppError(
        404,
        MESSAGES.COMMON.ERROR.NOT_FOUND(RESOURCES.ORDER),
        ERROR_CODES.PAYMENT.ORDER_NOT_FOUND
      );
    }

    const order = payment.order;

    // 5. Kiểm tra số tiền (MoMo gửi số tiền gốc, không nhân 100 như VNPAY)
    if (Number(order.totalAmount) !== Number(amount)) {
      throw new AppError(
        400,
        MESSAGES.PAYMENT.ERROR.INVALID_AMOUNT,
        ERROR_CODES.PAYMENT.INVALID_AMOUNT
      );
    }

    // 6. KIỂM TRA IDEMPOTENCY
    if (order.status === 'SUCCESS') {
      return { message: 'Already processed', code: 204 }; // Trả 204 cho MoMo biết đã xử lý xong
    }

    // 7. Xử lý ghi nhận trạng thái
    if (resultCode === 0) {
      await this.publicRepository.updateOrderSuccessTransaction(
        payment.id,
        order.id,
        order.userId,
        String(transId),
        payload
      );
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', webhookPayload: payload },
      });
    }

    return { message: 'Confirm Success', code: 204 };
  }
}
