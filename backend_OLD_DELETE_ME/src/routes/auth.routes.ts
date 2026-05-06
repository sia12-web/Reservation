import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validator';
import { validatePassword, passwordRequirementsMessage } from '../utils/passwordValidator';
import {
  loginLimiter,
  registerLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
} from '../middleware/rateLimiter';

const router = Router();

// Register
router.post(
  '/register',
  registerLimiter,
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('username').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('password').custom((value) => {
      if (!validatePassword(value)) {
        throw new Error(passwordRequirementsMessage);
      }
      return true;
    }),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').optional(),
  ],
  validate,
  authController.register
);

// Login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login
);

// Verify Email
router.post(
  '/verify-email',
  verifyEmailLimiter,
  [body('token').notEmpty().withMessage('Token is required')],
  validate,
  authController.verifyEmail
);

// Resend Verification
router.post(
  '/resend-verification',
  resendVerificationLimiter,
  [body('email').isEmail().withMessage('Invalid email format')],
  validate,
  authController.resendVerification
);

export default router;
