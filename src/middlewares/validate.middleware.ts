import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Ép kiểu dữ liệu an toàn từ Zod (Đồng thời loại bỏ các field rác hacker gửi lên)
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Làm phẳng lỗi của Zod cho Frontend dễ đọc
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({
          success: false,
          message: 'Dữ liệu đầu vào không hợp lệ',
          errors: formattedErrors,
        });
        return;
      }
      res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
    }
  };
};
