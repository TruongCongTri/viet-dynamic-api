import { AdminSystemRepository } from './admin-system.repository';
import { AppError } from '@/common/errors/app.error';
import { ERROR_CODES } from '@/constants/error-codes';
import { CreateForbiddenWordDTO, CreateRoleDTO } from './admin-system.schema';

export class AdminSystemService {
  private readonly systemRepo: AdminSystemRepository;
  private readonly PROTECTED_ROLES = ['ADMIN', 'STUDENT'];

  constructor() {
    this.systemRepo = new AdminSystemRepository();
  }

  // ==========================================
  // [A] HEALTH CHECK
  // ==========================================
  public async getSystemHealth() {
    const isDbConnected = await this.systemRepo.checkDatabaseConnection();

    // Lấy thống kê RAM và Uptime của Node.js
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    const healthData = {
      status: isDbConnected ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      services: {
        database: isDbConnected ? 'UP' : 'DOWN',
        server: 'UP',
      },
      metrics: {
        uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
        memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
    };

    if (!isDbConnected) {
      throw new AppError(
        503,
        'Mất kết nối Database',
        ERROR_CODES.COMMON.INTERNAL_SERVER_ERROR,
        healthData
      );
    }

    return healthData;
  }

  // ==========================================
  // [B] FORBIDDEN WORDS
  // ==========================================
  public async getForbiddenWords() {
    return this.systemRepo.getForbiddenWords();
  }

  public async addForbiddenWord(data: CreateForbiddenWordDTO) {
    const record = await this.systemRepo.createForbiddenWord(data.word);
    return { message: `Đã thêm từ "${record.word}" vào sổ đen.` };
  }

  public async removeForbiddenWord(id: string) {
    try {
      await this.systemRepo.deleteForbiddenWord(id);
      return { message: 'Đã gỡ bỏ từ cấm khỏi sổ đen.' };
    } catch (_error) {
      throw new AppError(404, 'Từ cấm không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    }
  }

  // ==========================================
  // [C] ROLES & PERMISSIONS
  // ==========================================
  public async getRolesAndPermissions() {
    const [roles, permissions] = await Promise.all([
      this.systemRepo.getRoles(),
      this.systemRepo.getPermissions(),
    ]);
    return { roles, availablePermissions: permissions };
  }

  public async createRole(data: CreateRoleDTO) {
    // 1. Tạo một object payload sạch
    const payload: { name: string; description?: string } = {
      name: data.name,
    };

    // 2. Chỉ thêm description vào nếu nó thực sự có giá trị (không phải undefined)
    if (data.description !== undefined && data.description !== null) {
      payload.description = data.description;
    }

    // Chống trùng tên Role
    try {
      // 3. Truyền object đã được làm sạch này vào repository
      const role = await this.systemRepo.createRole(payload);
      return { message: 'Tạo Role mới thành công', role };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new AppError(409, 'Tên Role này đã tồn tại', ERROR_CODES.COMMON.INVALID_INPUT);
      }
      throw error;
    }
  }

  public async updateRolePermissions(roleId: string, permissionIds: string[]) {
    // 1. Kiểm tra xem Role có tồn tại và có phải là Role hệ thống không
    const role = await this.systemRepo.getRoleById(roleId);

    if (!role) {
      throw new AppError(404, 'Role không tồn tại', ERROR_CODES.DATABASE.RECORD_NOT_FOUND);
    }

    // 2. Chặn thay đổi nếu là Role được bảo vệ
    if (this.PROTECTED_ROLES.includes(role.name.toUpperCase())) {
      throw new AppError(
        403,
        `Không thể thay đổi quyền hạn của Role hệ thống: ${role.name}`,
        ERROR_CODES.COMMON.FORBIDDEN
      );
    }

    // 3. Nếu vượt qua rào chắn -> Thực hiện update
    await this.systemRepo.updateRolePermissions(roleId, permissionIds);
    return { message: 'Cập nhật phân quyền cho Role thành công.' };
  }
}
