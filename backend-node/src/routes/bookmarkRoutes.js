import express from 'express';
import {
  createBookmark,
  getBookmarks,
  updateBookmark,
  deleteBookmark,
  reorderBookmarks
} from '../controllers/bookmarkController.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { checkCaseAccess } from '../middleware/caseAccess.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create bookmark (IO only)
router.post(
  '/',
  createBookmark
);

// Get bookmarks (IO and Supervisor)
router.get(
  '/case/:caseId',
  getBookmarks
);

// Update bookmark (IO only, own bookmarks)
router.put(
  '/:bookmarkId',
  updateBookmark
);

// Delete bookmark (IO only, own bookmarks)
router.delete(
  '/:bookmarkId',
  deleteBookmark
);

// Reorder bookmarks (IO only)
router.post(
  '/case/:caseId/reorder',
  reorderBookmarks
);

export default router;
