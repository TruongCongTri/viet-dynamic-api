import { prisma } from '@/common/configs/prisma';

export abstract class BaseRepository<T> {
  protected model: any;

  constructor(modelName: string) {
    // Truy cập động vào model của prisma
    this.model = (prisma as any)[modelName];
  }

  public async findById(id: string, options?: { select?: any; include?: any }): Promise<any> {
    return this.model.findUnique({
      where: { id },
      ...options,
    });
  }

  async findAll(): Promise<T[]> {
    return this.model.findMany();
  }

  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } });
  }
}
