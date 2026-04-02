import express from 'express';
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  resetUserPassword,
  getInvestigatingOfficers,
  getSupervisors,
  deleteUser
} from '../controllers/userController.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// User CRUD operations
router.post(
  '/',
  requirePermission('create_user'),
  createUser
);

router.get(
  '/',
  requirePermission('view_users'),
  getUsers
);

router.get(
  '/officers',
  getInvestigatingOfficers
);

router.get(
  '/supervisors',
  getSupervisors
);

router.get(
  '/:userId',
  requirePermission('view_users'),
  getUserById
);

router.put(
  '/:userId',
  requirePermission('modify_user'),
  updateUser
);

router.post(
  '/:userId/reset-password',
  requirePermission('modify_user'),
  resetUserPassword
);

router.delete(
  '/:userId',
  requirePermission('delete_user'),
  deleteUser
);

export default router;
