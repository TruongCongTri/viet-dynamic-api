import { Request, Response } from 'express';
import { successResponse } from '@/common/utils/responses/api-response';
import { AdminFinanceService } from './admin-finance.service';
import { QueryOrdersDTO, RefundOrderDTO, UpdateOrderStatusDTO } from './admin-finance.schema';

export class AdminFinanceController {
  private readonly financeService: AdminFinanceService;

  constructor() {
    this.financeService = new AdminFinanceService();
  }

  public getOrders = async (req: Request, res: Response) => {
    const query = req.query as unknown as QueryOrdersDTO;
    const { data, meta } = await this.financeService.getOrders(query);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy danh sách hóa đơn thành công',
      data,
      meta,
    });
  };

  public getOrderDetail = async (req: Request, res: Response) => {
    const orderId = req.params.id as string;
    const result = await this.financeService.getOrderDetail(orderId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy chi tiết hóa đơn thành công',
      data: result,
    });
  };

  public getPaymentPayload = async (req: Request, res: Response) => {
    const paymentId = req.params.id as string;
    const result = await this.financeService.getPaymentPayload(paymentId);
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy thông tin đối soát giao dịch thành công',
      data: result,
    });
  };

  public queryPaymentStatus = async (req: Request, res: Response) => {
    const paymentId = req.params.id as string;
    const result = await this.financeService.queryPaymentStatus(paymentId, req.ip);
    successResponse(res, { statusCode: 200, message: result.message, data: result });
  };

  public refundOrder = async (req: Request, res: Response) => {
    const orderId = req.params.id as string;
    const payload = req.body as RefundOrderDTO;
    const result = await this.financeService.refundOrder(orderId, payload.reason);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public cleanupTrashOrders = async (_req: Request, res: Response) => {
    const result = await this.financeService.cleanupTrashOrders();
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public getFinanceOverview = async (_req: Request, res: Response) => {
    const result = await this.financeService.getFinanceOverview();
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy tổng quan tài chính thành công',
      data: result,
    });
  };

  public updateOrderStatusManual = async (req: Request, res: Response) => {
    const orderId = req.params.id as string;
    const { status } = req.body as UpdateOrderStatusDTO;

    const result = await this.financeService.updateOrderStatusManual(orderId, status);
    successResponse(res, { statusCode: 200, message: result.message });
  };

  public getCourseRevenueStats = async (_req: Request, res: Response) => {
    const result = await this.financeService.getCourseRevenueStats();
    successResponse(res, {
      statusCode: 200,
      message: 'Lấy thống kê doanh thu khóa học thành công',
      data: result,
    });
  };
}
