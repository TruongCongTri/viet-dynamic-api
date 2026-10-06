import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env.config';

let io: Server;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // 1. Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error: No token provided'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as any;

      // Attach user ID to the socket object for later use
      socket.data.userId = decoded.id;
      next();
    } catch (_error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // 2. Connection Logic
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`🟢 [Socket] User connected: ${userId} (Socket ID: ${socket.id})`);

    // Join a personal room to receive private direct notifications
    socket.join(userId);

    // Allow user to subscribe to specific Workspace events
    socket.on('joinWorkspace', (workspaceId: string) => {
      // TODO: Verify if user actually belongs to this workspace via DB
      socket.join(`workspace_${workspaceId}`);
      console.log(`User ${userId} joined room: workspace_${workspaceId}`);
    });

    socket.on('leaveWorkspace', (workspaceId: string) => {
      socket.leave(`workspace_${workspaceId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔴 [Socket] User disconnected: ${userId}`);
    });
  });

  return io;
};

// Expose a getter to use `io` inside our Express Services
export const getIO = () => {
  if (!io) throw new Error('Socket.io has not been initialized!');
  return io;
};
