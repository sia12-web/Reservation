import { Router } from 'express';
import { body } from 'express-validator';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router = Router();

router.get('/', authenticate, messageController.getMessages);
router.post(
  '/',
  authenticate,
  [body('content').notEmpty().withMessage('Message content required')],
  validate,
  messageController.createMessage
);
router.put('/:id/read', authenticate, messageController.markAsRead);
router.get('/conversations', authenticate, messageController.getConversations);

export default router;
