import { Request, Response } from 'express';
import prisma from '../config/database';

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, limit = 50, offset = 0 } = req.query;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.userId as string },
          { receiverId: req.userId as string },
          courseId ? { courseId: courseId as string } : {},
        ].filter((condition): condition is any => Object.keys(condition).length > 0),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const createMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, receiverId, courseId } = req.body;

    const message = await prisma.message.create({
      data: {
        content,
        senderId: req.userId as string,
        receiverId,
        courseId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const messageId = id as string;

    const message = await prisma.message.updateMany({
      where: {
        id: messageId,
        receiverId: req.userId as string,
      },
      data: {
        read: true,
      },
    });

    res.json({ message: 'Messages marked as read', count: message.count });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all unique conversations where user is either sender or receiver
    const sentMessages = await prisma.message.findMany({
      where: { senderId: req.userId as string },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: req.userId as string },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const userIds = new Set([
      ...sentMessages.map((m) => m.receiverId).filter((id): id is string => id !== null),
      ...receivedMessages.map((m) => m.senderId),
    ]);

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    // Get last message for each conversation
    const conversations = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: req.userId as string, receiverId: user.id },
              { senderId: user.id, receiverId: req.userId as string },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          user,
          lastMessage,
        };
      })
    );

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};
