import { prisma } from '@/common/configs/prisma.config';

export class AdminSystemRepository {
  // ==========================================
  // [A] HEALTH CHECK
  // ==========================================
  public async checkDatabaseConnection(): Promise<boolean> {
    try {
      // Bắn 1 câu query siêu nhẹ để ping DB
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (_error) {
      return false;
    }
  }

  // ==========================================
  // [B] FORBIDDEN WORDS (TỪ CẤM)
  // ==========================================
  public async getForbiddenWords() {
    return prisma.forbiddenWord.findMany({ orderBy: { createdAt: 'desc' } });
  }

  public async createForbiddenWord(word: string) {
    // Dùng upsert để nếu từ này có rồi thì không văng lỗi sập server
    return prisma.forbiddenWord.upsert({
      where: { word },
      update: {},
      create: { word },
    });
  }

  public async deleteForbiddenWord(id: string) {
    return prisma.forbiddenWord.delete({ where: { id } });
  }

  // ==========================================
  // [C] ROLES & PERMISSIONS (PHÂN QUYỀN ĐỘNG)
  // ==========================================
  public async getRoles() {
    return prisma.role.findMany({
      include: {
        _count: { select: { users: true } }, // Đếm xem Role này đang có bao nhiêu người
        permissions: { include: { permission: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  public async getPermissions() {
    // Trả về toàn bộ danh sách Quyền của hệ thống (Được định nghĩa sẵn trong DB Seed)
    return prisma.permission.findMany({
      orderBy: { action: 'asc' },
    });
  }

  public async createRole(data: { name: string; description?: string }) {
    const createPayload: any = {
      name: data.name,
    };

    if (data.description !== undefined) {
      createPayload.description = data.description;
    }

    return prisma.role.create({ data: createPayload });
  }

  public async updateRolePermissions(roleId: string, permissionIds: string[]) {
    // Dùng Transaction: Xóa sạch quyền cũ -> Gán quyền mới
    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    });
  }

  public async getRoleById(roleId: string) {
    return prisma.role.findUnique({
      where: { id: roleId },
      select: { name: true }, // Chỉ cần lấy name để check quyền
    });
  }
}
