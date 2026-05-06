import { Request, Response } from 'express';
import prisma from '../config/database';

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        major: true,
        year: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, bio, avatar, major, year } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        firstName,
        lastName,
        bio,
        avatar,
        major,
        year,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        major: true,
        year: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        major: true,
        year: true,
        courses: {
          select: {
            course: true,
            semester: true,
            year: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q, major, year } = req.query;

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.userId } },
          q
            ? {
                OR: [
                  { firstName: { contains: q as string, mode: 'insensitive' } },
                  { lastName: { contains: q as string, mode: 'insensitive' } },
                  { username: { contains: q as string, mode: 'insensitive' } },
                ],
              }
            : {},
          major ? { major: major as string } : {},
          year ? { year: parseInt(year as string) } : {},
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        major: true,
        year: true,
      },
      take: 20,
    });

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};
