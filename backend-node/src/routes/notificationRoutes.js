import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', getNotifications);

// Mark all as read
router.put('/read-all', markAllAsRead);

// Mark specific notification as read
router.put('/:notificationId/read', markAsRead);

export default router;
