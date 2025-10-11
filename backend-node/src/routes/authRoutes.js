import express from 'express';
import {
  login,
  getCurrentUser,
  logout,
  changePassword
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

export default router;
