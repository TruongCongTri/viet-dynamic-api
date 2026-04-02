import nodemailer from 'nodemailer';
import axios from 'axios';
import { env } from '@/common/configs/env';
import { ERROR_CODES } from '@/constants/error-codes';
import { AppError } from '../errors/app.error';
import { MESSAGES } from '@/constants/messages';

export class NotificationService {
  private emailTransporter;

  constructor() {
    // Cấu hình Nodemailer (Dùng Gmail, SendGrid, hoặc AWS SES)
    this.emailTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: {
        user: env.SMTP_USER, // VD: cskh@vietdynamic.com
        pass: env.SMTP_PASSWORD, // App Password của Gmail
      },
    });
  }

  // 1. GỬI QUA EMAIL
  async sendEmailOTP(to: string, otpCode: string) {
    try {
      // mock email sending for demo
      console.log(`\n\n📧 [MOCK EMAIL] Đã giả lập gửi thư tới: ${to}`);
      console.log(`🔑 [MOCK EMAIL] MÃ OTP CỦA BẠN LÀ: ${otpCode}\n\n`);

      if (process.env.NODE_ENV === 'production') {
        await this.emailTransporter.sendMail({
          from: `"Viet Dynamic" <${process.env.SMTP_USER}>`,
          to,
          subject: 'Mã xác thực tài khoản Viet Dynamic',
          html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
              <h2>Xác thực tài khoản của bạn</h2>
              <p>Mã OTP của bạn có hiệu lực trong 5 phút:</p>
              <h1 style="color: #4CAF50; font-size: 40px; letter-spacing: 5px;">${otpCode}</h1>
              <p>Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
            </div>
          `,
        });
      }

      return true;
    } catch (error) {
      console.error('Lỗi gửi Email:', error);
      throw new AppError(
        500,
        MESSAGES.NOTIFICATION.EMAIL_FAILED,
        ERROR_CODES.NOTIFICATION.SEND_EMAIL_FAILED
      );
    }
  }

  // 2. GỬI QUA SMS (Sử dụng eSMS.vn hoặc Stringee - Phổ biến ở VN)
  async sendSmsOTP(phone: string, otpCode: string) {
    try {
      if (!env.ESMS_API_KEY || !env.ESMS_SECRET_KEY)
        throw new AppError(
          500,
          MESSAGES.NOTIFICATION.MISSING_ESMS_KEYS,
          ERROR_CODES.NOTIFICATION.MISSING_CONFIG
        );

      const response = await axios.get(env.ESMS_URL, {
        params: {
          Phone: phone,
          Content: `Ma xac thuc Viet Dynamic cua ban la: ${otpCode}. Khong chia se ma nay.`,
          ApiKey: env.ESMS_API_KEY,
          SecretKey: env.ESMS_SECRET_KEY,
          SmsType: 2, // Brandname CSKH
          Brandname: 'VIETDYNAMIC',
        },
      });

      if (response.data.CodeResult !== '100') {
        throw new AppError(
          502,
          MESSAGES.NOTIFICATION.SMS_REJECTED,
          ERROR_CODES.NOTIFICATION.GATEWAY_REJECTED
        );
      }
      return true;
    } catch (error) {
      console.error('Lỗi gửi SMS:', error);
      throw new AppError(
        500,
        MESSAGES.NOTIFICATION.SMS_FAILED,
        ERROR_CODES.NOTIFICATION.SEND_SMS_FAILED
      );
    }
  }

  // 3. GỬI QUA ZALO ZNS (Zalo Notification Service)
  async sendZaloOTP(phone: string, otpCode: string) {
    try {
      if (!env.ZALO_ACCESS_TOKEN)
        throw new AppError(
          500,
          MESSAGES.NOTIFICATION.MISSING_ZALO_TOKEN,
          ERROR_CODES.NOTIFICATION.MISSING_CONFIG
        );

      // Format số điện thoại về chuẩn của Zalo (84xxxxx)
      const formattedPhone = phone.startsWith('0') ? `84${phone.slice(1)}` : phone;

      const response = await axios.post(
        env.ZALO_ZNS_URL,
        {
          phone: formattedPhone,
          template_id: env.ZALO_OTP_TEMPLATE_ID,
          template_data: {
            otp_code: otpCode, // Biến này phải khớp với template bạn khai báo trên Zalo
            // name: "Học viên", v.v...
          },
        },
        {
          headers: {
            access_token: env.ZALO_ACCESS_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.error) {
        throw new Error(response.data.message);
      }
      return true;
    } catch (error) {
      console.error('Lỗi gửi Zalo ZNS:', error);
      throw new AppError(
        500,
        MESSAGES.NOTIFICATION.ZALO_FAILED,
        ERROR_CODES.NOTIFICATION.SEND_ZALO_FAILED
      );
    }
  }
}

export const notificationService = new NotificationService();
