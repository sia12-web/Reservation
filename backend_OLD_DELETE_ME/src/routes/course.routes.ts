import { Router } from 'express';
import { body } from 'express-validator';
import * as courseController from '../controllers/course.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router = Router();

router.get('/', authenticate, courseController.getCourses);
router.get('/:id', authenticate, courseController.getCourseById);
router.post(
  '/',
  authenticate,
  [
    body('code').notEmpty().withMessage('Course code required'),
    body('name').notEmpty().withMessage('Course name required'),
    body('department').notEmpty().withMessage('Department required'),
  ],
  validate,
  courseController.createCourse
);
router.post('/:id/enroll', authenticate, courseController.enrollInCourse);
router.delete('/:id/enroll', authenticate, courseController.unenrollFromCourse);
router.get('/:id/students', authenticate, courseController.getCourseStudents);

export default router;
