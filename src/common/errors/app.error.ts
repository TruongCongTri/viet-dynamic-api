import { ErrorCode } from '@/constants/error-codes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string | number;

  constructor(statusCode: number, message: string, errorCode?: ErrorCode) {
    super(message);
    this.statusCode = statusCode;

    if (errorCode !== undefined) {
      this.errorCode = errorCode;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
