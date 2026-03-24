import app from '@/app';
import { env } from '@/common/configs/env';

const startServer = () => {
  try {
    const port = parseInt(env.PORT, 10);
    
    app.listen(port, () => {
      console.log(`=================================`);
      console.log(`🚀 API Server đang chạy tại: http://localhost:${port}`);
      console.log(`🛡️  Chấp nhận kết nối từ: ${env.CLIENT_URL}`);
      console.log(`=================================`);
    });
  } catch (error) {
    console.error('Lỗi khởi động server:', error);
    process.exit(1);
  }
};

startServer();