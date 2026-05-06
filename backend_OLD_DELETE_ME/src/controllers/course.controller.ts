import { Request, Response } from 'express';
import prisma from '../config/database';

export const getCourses = async (req: Request, res: Response) => {
  try {
    const { search, department } = req.query;

    const courses = await prisma.course.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { code: { contains: search as string, mode: 'insensitive' } },
                  { name: { contains: search as string, mode: 'insensitive' } },
                ],
              }
            : {},
          department ? { department: department as string } : {},
        ],
      },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseId = id as string;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                major: true,
                year: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    res.json(course);
  } catch (error) {
    console.error('Get course by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
};

export const createCourse = async (req: Request, res: Response) => {
  try {
    const { code, name, department, description } = req.body;

    const course = await prisma.course.create({
      data: {
        code,
        name,
        department,
        description,
      },
    });

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

export const enrollInCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseId = id as string;
    const { semester, year } = req.body;

    const enrollment = await prisma.courseEnrollment.create({
      data: {
        userId: req.userId as string,
        courseId: courseId,
        semester,
        year,
      },
      include: {
        course: true,
      },
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Enroll in course error:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
};

export const unenrollFromCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseId = id as string;

    await prisma.courseEnrollment.deleteMany({
      where: {
        userId: req.userId as string,
        courseId: courseId,
      },
    });

    res.json({ message: 'Successfully unenrolled from course' });
  } catch (error) {
    console.error('Unenroll from course error:', error);
    res.status(500).json({ error: 'Failed to unenroll from course' });
  }
};

export const getCourseStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseId = id as string;

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId: courseId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            major: true,
            year: true,
          },
        },
      },
    });

    res.json(enrollments);
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({ error: 'Failed to fetch course students' });
  }
};
