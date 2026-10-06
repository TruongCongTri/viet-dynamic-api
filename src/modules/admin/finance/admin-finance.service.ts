import { env } from '@/common/configs/env.config';
import { AdminFinanceRepository } from './admin-finance.repository';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { PaginationMetaDto } from '@/data/dtos/pagination.dto';
import moment from 'moment-timezone';
import * as crypto from 'crypto';

export class AdminFinanceService {
  private readonly financeRepo: AdminFinanceRepository;

  constructor() {
    this.financeRepo = new AdminFinanceRepository();
  }

  public async getOrders(query: any) {
    const { total, data } = await this.financeRepo.findOrders(query);
    const meta = PaginationMetaDto.create(query.page || 1, query.limit || 20, total);
    return { data, meta };
  }

  public async getOrderDetail(id: string) {
    const order = await this.financeRepo.getOrderDetail(id);
    if (!order)
      throw new AppError(404, 'Hóa đơn không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    return order;
  }

  public async getPaymentPayload(id: string) {
    const payment = await this.financeRepo.getPaymentPayload(id);
    if (!payment)
      throw new AppError(404, 'Giao dịch không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    return payment; // Trả về raw JSON để Admin soi lỗi [cite: 785]
  }

  public async queryPaymentStatus(orderId: string, clientIp: string = '127.0.0.1') {
    const order = await this.financeRepo.getOrderDetail(orderId);
    if (!order)
      throw new AppError(404, 'Đơn hàng không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);

    if (order.status === 'SUCCESS') {
      return {
        message: 'Đơn hàng đã thanh toán THÀNH CÔNG từ trước. Không cần tra soát.',
        providerStatus: 'ALREADY_SUCCESS',
      };
    }

    // Lấy lần thử quẹt thẻ mới nhất (đã orderBy createdAt desc ở Repository)
    const payment = order.payments[0];
    if (!payment) {
      throw new AppError(
        400,
        'Không tìm thấy lịch sử giao dịch (Payment) để tra soát.',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    // ==========================================
    // TRA SOÁT VNPAY BẰNG NATIVE FETCH (QueryDR)
    // ==========================================
    if (payment.provider === 'VNPAY') {
      const tmnCode = env.VNPAY_TMN_CODE;
      const secretKey = env.VNPAY_HASH_SECRET;
      const vnpApiUrl = env.VNPAY_API_URL; // Cần cấu hình link API QueryDR của VNPAY trong .env (khác với link tạo thanh toán)

      if (!tmnCode || !secretKey || !vnpApiUrl) {
        throw new AppError(
          500,
          'Lỗi cấu hình hệ thống VNPAY',
          ERROR_CODES.COMMON.INTERNAL_SERVER_ERROR
        );
      }

      // 1. Tạo các tham số bắt buộc của VNPAY (Ép múi giờ GMT+7)
      const date = new Date();
      const vnp_RequestId = crypto.randomUUID(); // ID ngẫu nhiên cho mỗi lần gửi request
      const vnp_Version = '2.1.0';
      const vnp_Command = 'querydr';
      const vnp_TxnRef = payment.id;
      const vnp_OrderInfo = 'Truy van giao dich ' + orderId;
      const vnp_TransactionDate = moment(payment.createdAt)
        .tz('Asia/Ho_Chi_Minh')
        .format('YYYYMMDDHHmmss'); // Thời gian tạo đơn
      const vnp_CreateDate = moment(date).tz('Asia/Ho_Chi_Minh').format('YYYYMMDDHHmmss'); // Thời gian bấm nút tra soát

      // 2. Tạo chữ ký (Signature) chuẩn VNPAY cho API QueryDR
      // Cấu trúc Data băm: RequestId|Version|Command|TmnCode|TxnRef|TransactionDate|CreateDate|IpAddr|OrderInfo
      const signData = `${vnp_RequestId}|${vnp_Version}|${vnp_Command}|${tmnCode}|${vnp_TxnRef}|${vnp_TransactionDate}|${vnp_CreateDate}|${clientIp}|${vnp_OrderInfo}`;
      const hmac = crypto.createHmac('sha512', secretKey);
      const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      const requestBody = {
        vnp_RequestId,
        vnp_Version,
        vnp_Command,
        vnp_TmnCode: tmnCode,
        vnp_TxnRef,
        vnp_OrderInfo,
        vnp_TransactionDate,
        vnp_CreateDate,
        vnp_IpAddr: clientIp,
        vnp_SecureHash,
      };

      try {
        // 3. Dùng Native Fetch gọi sang VNPAY
        const response = await fetch(vnpApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const data = (await response.json()) as {
          vnp_ResponseCode?: string;
          vnp_TransactionStatus?: string;
          [key: string]: any;
        };

        // 4. Phân tích kết quả từ VNPAY
        // vnp_ResponseCode === '00' là API gọi thành công
        // vnp_TransactionStatus === '00' là Đã trừ tiền khách hàng thành công
        if (data.vnp_ResponseCode === '00' && data.vnp_TransactionStatus === '00') {
          // Bắt được đơn hàng "Ma": Khách đã trả tiền nhưng rớt mạng
          // ÉP ĐỒNG BỘ: Cấp khóa học ngay lập tức!
          await this.financeRepo.syncOrderSuccess(order.id, order.userId, payment.id);
          return {
            message: 'Khách hàng đã trả tiền! Hệ thống đã ép đồng bộ và cấp khóa học thành công.',
            providerStatus: 'SUCCESS',
            rawData: data,
          };
        } else {
          return {
            message: 'Giao dịch chưa thanh toán, hoặc đã bị hủy từ phía Ngân hàng.',
            providerStatus: data.vnp_TransactionStatus,
            rawData: data,
          };
        }
      } catch (_error) {
        throw new AppError(
          502,
          'Lỗi kết nối đến máy chủ VNPAY',
          ERROR_CODES.COMMON.INTERNAL_SERVER_ERROR
        );
      }
    }

    // ==========================================
    // TRA SOÁT MOMO (Tương lai)
    // ==========================================
    else if (payment.provider === 'MOMO') {
      return { message: 'Chưa hỗ trợ tra soát chủ động cho MoMo', providerStatus: 'UNKNOWN' };
    }

    throw new AppError(
      400,
      'Phương thức thanh toán không hợp lệ',
      ERROR_CODES.COMMON.INVALID_INPUT
    );
  }

  public async refundOrder(orderId: string, reason: string) {
    const order = await this.financeRepo.getOrderDetail(orderId);

    if (!order)
      throw new AppError(404, 'Hóa đơn không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    if (order.status !== 'SUCCESS') {
      throw new AppError(
        400,
        'Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán THÀNH CÔNG',
        ERROR_CODES.COMMON.INVALID_INPUT
      );
    }

    // [VÁ LỖI LINTER]: Sử dụng biến reason để lưu log hệ thống phục vụ đối soát
    console.log(`[FINANCE - REFUND] Bắt đầu hoàn tiền Hóa đơn ID: ${orderId}. Lý do: ${reason}`);

    // Lúc này TypeScript đã nhận diện được `order.items` nhờ việc sửa Repository ở trên
    const courseIds = order.items.map((item) => item.courseId);

    // Kích hoạt Transaction
    await this.financeRepo.refundOrderTransaction(order.id, order.userId, courseIds);

    return {
      message: `Hoàn tiền thành công. Đã thu hồi quyền truy cập ${courseIds.length} khóa học của học viên.`,
    };
  }

  public async cleanupTrashOrders() {
    const count = await this.financeRepo.cleanupPendingTrash();
    return { message: `Đã dọn dẹp ${count} đơn hàng rác và hoàn trả lượt dùng Voucher.` };
  }

  public async getFinanceOverview() {
    return this.financeRepo.getFinanceOverview();
  }

  public async updateOrderStatusManual(orderId: string, status: string) {
    const order = await this.financeRepo.getOrderDetail(orderId);
    if (!order)
      throw new AppError(404, 'Đơn hàng không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    if (order.status === status) return { message: 'Trạng thái không thay đổi' };

    // Kế toán báo khách đã trả tiền -> Ép cấp khóa học (Transaction)
    if (status === 'SUCCESS') {
      // Tìm payment ID gần nhất để đồng bộ (nếu có), nếu không có thì truyền 'MANUAL_PAYMENT' (cần cấu hình Prisma cho phép string tự do hoặc bỏ qua paymentId)
      const paymentId = order.payments[0]?.id;

      if (paymentId) {
        await this.financeRepo.syncOrderSuccess(orderId, order.userId, paymentId);
      } else {
        // Nếu đơn hàng tạo ra không có payment link, tự động update Order và Enrollment
        await this.financeRepo.syncOrderSuccess(orderId, order.userId, ''); // Handle logic rỗng trong Repo nếu cần
      }
      return { message: 'Đã cập nhật đơn hàng thành SUCCESS và cấp quyền khóa học.' };
    }

    // Với các trạng thái khác, cập nhật thông thường
    await this.financeRepo.update(orderId, { status });
    return { message: `Đã cập nhật trạng thái đơn hàng thành ${status}` };
  }

  public async getCourseRevenueStats() {
    return this.financeRepo.getCourseRevenueStats();
  }
}
