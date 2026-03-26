import { Response } from 'express';
import { PaginationMetaDto } from '@/data/dtos/pagination.dto';

// --- TYPE DEFINITIONS ---

/**
 * Cấu trúc chi tiết cho lỗi Validation (thường dùng cho Zod)
 */
export interface ValidationErrorDetail {
  field: string | number;
  message: string;
  code?: string;
}

/**
 * Định nghĩa kiểu dữ liệu cho errors thay thế cho 'any'
 */
export type ApiErrorData = string | string[] | ValidationErrorDetail[] | Record<string, unknown>;

// --- INTERFACES ---

interface BaseMeta {
  success: boolean;
  message: string;
}

interface SuccessMeta extends BaseMeta {
  success: true;
  pagination?: PaginationMetaDto;
}

interface ErrorMeta extends BaseMeta {
  success: false;
  error_code?: string | number;
  errors?: ApiErrorData;
}

interface SuccessResponseBody<T> {
  meta: SuccessMeta;
  data?: T;
}

interface ErrorResponseBody {
  meta: ErrorMeta;
}

// --- IMPLEMENTATION ---

export const successResponse = <T>(
  res: Response,
  {
    message,
    data,
    pagination,
    statusCode = 200,
  }: {
    message: string;
    data?: T;
    pagination?: PaginationMetaDto;
    statusCode?: number;
  }
): Response<SuccessResponseBody<T>> => {
  const responseBody: SuccessResponseBody<T> = {
    meta: {
      success: true,
      message,
      ...(pagination !== undefined && { pagination }),
    },
    ...(data !== undefined && { data }),
  };

  return res.status(statusCode).json(responseBody);
};

export const errorResponse = (
  res: Response,
  {
    message,
    statusCode = 400,
    error_code,
    errors,
  }: {
    message: string;
    statusCode?: number;
    error_code?: string | number;
    errors?: ApiErrorData;
  }
): Response<ErrorResponseBody> => {
  const responseBody: ErrorResponseBody = {
    meta: {
      success: false,
      message,
      ...(error_code !== undefined && { error_code }),
      ...(errors !== undefined && { errors }),
    },
  };

  return res.status(statusCode).json(responseBody);
};
