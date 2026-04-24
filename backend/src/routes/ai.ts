import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import openRouterService from '../services/openrouter';
import pool from '../db/connection';

const router = Router();

// Analyze menu from image (base64)
router.post('/analyze-image', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { imageBase64, menuId } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const result = await openRouterService.analyzeMenuImage(imageBase64, menuId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze menu from text
router.post('/analyze-text', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuText, menuId } = req.body;

    if (!menuText) {
      return res.status(400).json({ error: 'Menu text is required' });
    }

    const result = await openRouterService.analyzeMenuText(menuText, menuId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error analyzing text:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect allergens for a menu item
router.post('/detect-allergens', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemName, description, menuItemId } = req.body;

    if (!itemName) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const result = await openRouterService.detectAllergens(itemName, description || '', menuItemId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error detecting allergens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estimate calories for a menu item
router.post('/estimate-calories', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemName, description, menuItemId } = req.body;

    if (!itemName) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const result = await openRouterService.estimateCalories(itemName, description || '', menuItemId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error estimating calories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Translate menu item
router.post('/translate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemName, description, targetLanguage, menuItemId } = req.body;

    if (!itemName || !targetLanguage) {
      return res.status(400).json({ error: 'Item name and target language are required' });
    }

    const result = await openRouterService.translateMenuItem(itemName, description || '', targetLanguage, menuItemId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error translating:', error);
    res.status(500).json({ error: error.message });
  }
});

// Optimize price for a menu item
router.post('/optimize-price', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemName, description, currentPrice, category, menuItemId } = req.body;

    if (!itemName || currentPrice === undefined) {
      return res.status(400).json({ error: 'Item name and current price are required' });
    }

    const result = await openRouterService.optimizePrice(
      itemName,
      description || '',
      parseFloat(currentPrice),
      category || 'General',
      menuItemId
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error optimizing price:', error);
    res.status(500).json({ error: error.message });
  }
});

// Recommend dishes based on preferences
router.post('/recommend-dishes', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId, preferences, dietaryRestrictions, mealType, budget } = req.body;

    if (!menuId) {
      return res.status(400).json({ error: 'Menu ID is required' });
    }

    const result = await openRouterService.recommendDishes(
      parseInt(menuId),
      preferences || '',
      dietaryRestrictions || '',
      mealType || '',
      budget || ''
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error recommending dishes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze nutrition for healthcare
router.post('/nutrition-healthcare', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemName, description, healthConditions, menuItemId } = req.body;

    if (!itemName) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const result = await openRouterService.analyzeNutritionHealthcare(
      itemName,
      description || '',
      healthConditions || '',
      menuItemId
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      analysis: result.data,
      tokensUsed: result.tokensUsed
    });
  } catch (error: any) {
    console.error('Error analyzing nutrition healthcare:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI analysis history
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;

    let query = `
      SELECT aa.*, m.name as menu_name, m.restaurant_name
      FROM ai_analysis aa
      JOIN menus m ON aa.menu_id = m.id
      WHERE m.user_id = $1
    `;
    const params: any[] = [req.userId];

    if (type) {
      query += ` AND aa.analysis_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY aa.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching AI history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get price suggestions for a menu
router.get('/price-suggestions/menu/:menuId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId } = req.params;

    const result = await pool.query(
      `SELECT ps.*, mi.name as item_name, mi.description, mi.category
       FROM price_suggestions ps
       JOIN menu_items mi ON ps.menu_item_id = mi.id
       JOIN menus m ON mi.menu_id = m.id
       WHERE m.id = $1 AND m.user_id = $2
       ORDER BY ps.created_at DESC`,
      [menuId, req.userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching price suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dish recommendations for a menu
router.get('/recommendations/menu/:menuId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId } = req.params;

    const result = await pool.query(
      `SELECT dr.*
       FROM dish_recommendations dr
       JOIN menus m ON dr.menu_id = m.id
       WHERE m.id = $1 AND m.user_id = $2
       ORDER BY dr.created_at DESC
       LIMIT 50`,
      [menuId, req.userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a price suggestion
router.delete('/price-suggestions/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM price_suggestions ps
       USING menu_items mi, menus m
       WHERE ps.id = $1
       AND ps.menu_item_id = mi.id
       AND mi.menu_id = m.id
       AND m.user_id = $2`,
      [id, req.userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting price suggestion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a dish recommendation
router.delete('/recommendations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM dish_recommendations dr
       USING menus m
       WHERE dr.id = $1
       AND dr.menu_id = m.id
       AND m.user_id = $2`,
      [id, req.userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
