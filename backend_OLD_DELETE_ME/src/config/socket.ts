import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';

export const setupSocketIO = (io: SocketIOServer) => {
  // Authentication middleware
  io.use((socket: any, next) => {
    const token =
      socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);

      if (
        typeof decoded === 'object' &&
        decoded !== null &&
        typeof (decoded as any).userId === 'string' &&
        typeof (decoded as any).emailVerified === 'boolean'
      ) {
        // Check email verification (ADR-0008)
        if (!(decoded as any).emailVerified) {
          return next(new Error('Email verification required'));
        }

        socket.userId = (decoded as any).userId;
        socket.emailVerified = (decoded as any).emailVerified;
        next();
      } else {
        return next(new Error('Authentication error: Invalid token payload'));
      }
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: any) => {
    console.log(`✅ User connected: ${socket.userId} (${socket.id})`);

    // Join user's personal room for direct messages
    socket.join(`user:${socket.userId}`);

    // Join course rooms
    socket.on('join-course', (courseId: string) => {
      socket.join(`course:${courseId}`);
      console.log(`📚 User ${socket.userId} joined course: ${courseId}`);
    });

    // Leave course rooms
    socket.on('leave-course', (courseId: string) => {
      socket.leave(`course:${courseId}`);
      console.log(`📤 User ${socket.userId} left course: ${courseId}`);
    });

    // Handle typing status
    socket.on('typing-start', (data: { courseId?: string; receiverId?: string }) => {
      const room = data.courseId ? `course:${data.courseId}` : `user:${data.receiverId}`;
      socket.to(room).emit('user-typing', { userId: socket.userId });
    });

    socket.on('typing-stop', (data: { courseId?: string; receiverId?: string }) => {
      const room = data.courseId ? `course:${data.courseId}` : `user:${data.receiverId}`;
      socket.to(room).emit('user-stopped-typing', { userId: socket.userId });
    });

    // Handle new message
    socket.on('send-message', (data: any) => {
      // Broadcast to appropriate room
      if (data.courseId) {
        socket.to(`course:${data.courseId}`).emit('new-message', data);
      } else if (data.receiverId) {
        socket.to(`user:${data.receiverId}`).emit('new-message', data);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId} (${socket.id})`);
    });
  });

  return io;
};

export default setupSocketIO;
