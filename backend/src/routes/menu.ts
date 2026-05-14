import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  listMenus,
  getMenu,
  createMenu,
  updateMenu,
  deleteMenu,
  bulkDeleteMenus,
  bulkUpdateMenus,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getPublicMenu
} from '../controllers/menuController';

const router = Router();

// Public QR menu page — no authentication required
router.get('/:id/public', getPublicMenu as any);

// Protected menu CRUD
router.get('/', authenticateToken, listMenus as any);
router.get('/:id', authenticateToken, getMenu as any);
router.delete('/bulk', authenticateToken, authorize('admin', 'manager'), bulkDeleteMenus as any);
router.put('/bulk', authenticateToken, authorize('admin', 'manager'), bulkUpdateMenus as any);
router.post('/', authenticateToken, authorize('admin', 'manager'), createMenu as any);
router.put('/:id', authenticateToken, authorize('admin', 'manager'), updateMenu as any);
router.delete('/:id', authenticateToken, authorize('admin', 'manager'), deleteMenu as any);

// Menu item CRUD
router.get('/:menuId/items/:itemId', authenticateToken, getMenuItem as any);
router.post('/:menuId/items', authenticateToken, authorize('admin', 'manager'), createMenuItem as any);
router.put('/:menuId/items/:itemId', authenticateToken, authorize('admin', 'manager'), updateMenuItem as any);
router.delete('/:menuId/items/:itemId', authenticateToken, authorize('admin', 'manager'), deleteMenuItem as any);

export default router;
