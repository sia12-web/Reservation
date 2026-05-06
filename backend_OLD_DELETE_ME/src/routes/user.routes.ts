import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.get('/search', authenticate, userController.searchUsers);
router.get('/:id', authenticate, userController.getUserById);

export default router;
