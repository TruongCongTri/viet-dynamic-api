import { Request, Response } from 'express';
import { UserService } from './user.service';
import { successResponse } from '@/common/utils/responses/api-response';
import { DeleteAccountDTO, RequestEmailChangeDTO, UpdateProfileDTO } from './user.schema';

export class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // ==========================================
  // [A] USER PROFILE MANAGEMENT
  // ==========================================

  public getMyProfile = async (req: Request, res: Response) => {
    const userId = (req as any).user.id; // Nếu req.user chưa được định nghĩa type toàn cục
    const result = await this.userService.getMyProfile(userId);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy thông tin cá nhân thành công',
      data: result,
    });
  };

  public updateMyProfile = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data = req.body as UpdateProfileDTO;

    const result = await this.userService.updateMyProfile(userId, data);

    successResponse(res, {
      statusCode: 200,
      message: 'Cập nhật thông tin thành công',
      data: result,
    });
  };

  public updateAvatar = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const file = req.file; // File được hứng bởi middleware Multer

    const result = await this.userService.updateAvatar(userId, file);

    successResponse(res, {
      statusCode: 200,
      message: result.message,
      data: { avatarUrl: result.avatarUrl },
    });
  };

  // ==========================================
  // [B] SESSION & SECURITY MANAGEMENT
  // ==========================================

  public getMySessions = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await this.userService.getMySessions(userId);

    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách thiết bị thành công',
      data: result,
    });
  };

  public revokeSession = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const sessionId = req.params.sessionId as string;

    const result = await this.userService.revokeSession(userId, sessionId);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public revokeAllOtherSessions = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    // Giả định middleware verifyToken sẽ gán sessionId của phiên hiện tại vào req.user.sessionId
    const currentSessionId = (req as any).user.sessionId;

    const result = await this.userService.revokeAllOtherSessions(userId, currentSessionId);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public deleteMyAccount = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { passwordConfirm } = req.body as DeleteAccountDTO;

    const result = await this.userService.deleteMyAccount(userId, passwordConfirm);

    successResponse(res, { statusCode: 200, message: result.message });
  };

  public requestEmailChange = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { newEmail } = req.body as RequestEmailChangeDTO;

    const result = await this.userService.requestEmailChange(userId, newEmail);
    successResponse(res, { statusCode: 200, message: result.message });
  };
}
