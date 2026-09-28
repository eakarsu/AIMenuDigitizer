import { Response } from 'express';
import pdfParse from 'pdf-parse';
import { AuthRequest } from '../middleware/auth';
import openRouterService from '../services/openrouter';
import { enqueueJob, getJob } from '../services/jobQueue';
import pool from '../db/connection';

// ---------------------------------------------------------------------------
// Tenant scoping helpers — AI endpoints must reject ids that belong to another
// account instead of reading/logging against them.
// ---------------------------------------------------------------------------

async function menuOwnedByUser(menuId: unknown, userId: number | undefined): Promise<boolean> {
  if (!menuId || !userId) return false;
  const result = await pool.query('SELECT id FROM menus WHERE id = $1 AND user_id = $2', [menuId, userId]);
  return result.rows.length > 0;
}

async function menuItemOwnedByUser(menuItemId: unknown, userId: number | undefined): Promise<boolean> {
  if (!menuItemId || !userId) return false;
  const result = await pool.query(
    `SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE mi.id = $1 AND m.user_id = $2`,
    [menuItemId, userId]
  );
  return result.rows.length > 0;
}

// ---------------------------------------------------------------------------
// PDF text extraction — never pass base64 bytes to the model.
// Accepts plain extracted text, or base64 PDF data (with or without the
// [PDF_BASE64]: marker the UI sends). Uses pdf-parse; image-only PDFs are
// rejected with a clear error instead of being sent to the model as garbage.
// ---------------------------------------------------------------------------

const PDF_BASE64_PREFIX = '[PDF_BASE64]:';

async function extractPdfText(input: string): Promise<{ text?: string; error?: string }> {
  const isMarkedBase64 = input.startsWith(PDF_BASE64_PREFIX);
  const maybeBase64 = isMarkedBase64 ? input.slice(PDF_BASE64_PREFIX.length) : input.trim();
  if (!isMarkedBase64 && !maybeBase64.startsWith('JVBER')) {
    // Plain text extracted elsewhere — pass through unchanged.
    return { text: input };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(maybeBase64, 'base64');
  } catch {
    return { error: 'PDF payload is not valid base64 data' };
  }

  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { error: 'PDF payload is not a valid PDF document' };
  }

  try {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text || '').trim();
    if (!text) {
      return { error: 'No extractable text found in this PDF. Scanned/image-only PDFs are not supported — upload an image for vision analysis instead.' };
    }
    return { text };
  } catch (error: any) {
    return { error: `Failed to extract text from PDF: ${error.message}` };
  }
}

// ---------------------------------------------------------------------------
// Job status endpoint — GET /api/ai/jobs/:id
// ---------------------------------------------------------------------------

export async function getJobStatus(req: AuthRequest, res: Response): Promise<void> {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    result: job.status === 'done' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined
  });
}

// ---------------------------------------------------------------------------
// Image analysis — POST /api/ai/analyze-image
// ---------------------------------------------------------------------------

export async function analyzeImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { imageBase64, menuId, mimeType } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'Image data is required' });
      return;
    }

    if (menuId && !(await menuOwnedByUser(menuId, req.userId))) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await openRouterService.analyzeMenuImage(imageBase64, menuId, mimeType);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Text analysis — POST /api/ai/analyze-text
// ---------------------------------------------------------------------------

export async function analyzeText(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuText, menuId } = req.body;

    if (!menuText) {
      res.status(400).json({ error: 'Menu text is required' });
      return;
    }

    if (menuId && !(await menuOwnedByUser(menuId, req.userId))) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await openRouterService.analyzeMenuText(menuText, menuId);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error analyzing text:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Allergen detection — POST /api/ai/detect-allergens
// ---------------------------------------------------------------------------

export async function detectAllergens(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { itemName, description, menuItemId } = req.body;

    if (!itemName) {
      res.status(400).json({ error: 'Item name is required' });
      return;
    }

    if (menuItemId && !(await menuItemOwnedByUser(menuItemId, req.userId))) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    const result = await openRouterService.detectAllergens(itemName, description || '', menuItemId);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error detecting allergens:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Calorie estimation — POST /api/ai/estimate-calories
// ---------------------------------------------------------------------------

export async function estimateCalories(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { itemName, description, menuItemId } = req.body;

    if (!itemName) {
      res.status(400).json({ error: 'Item name is required' });
      return;
    }

    if (menuItemId && !(await menuItemOwnedByUser(menuItemId, req.userId))) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    const result = await openRouterService.estimateCalories(itemName, description || '', menuItemId);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error estimating calories:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Translation — POST /api/ai/translate
// ---------------------------------------------------------------------------

export async function translateMenuItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { itemName, description, targetLanguage, menuItemId } = req.body;

    if (!itemName || !targetLanguage) {
      res.status(400).json({ error: 'Item name and target language are required' });
      return;
    }

    if (menuItemId && !(await menuItemOwnedByUser(menuItemId, req.userId))) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    const result = await openRouterService.translateMenuItem(itemName, description || '', targetLanguage, menuItemId);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error translating:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Price optimization — POST /api/ai/optimize-price  (queued — slow)
// Returns { jobId } immediately; poll GET /api/ai/jobs/:id for result.
// ---------------------------------------------------------------------------

export async function optimizePriceQueued(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { itemName, description, currentPrice, category, menuItemId } = req.body;

    if (!itemName || currentPrice === undefined) {
      res.status(400).json({ error: 'Item name and current price are required' });
      return;
    }

    if (menuItemId && !(await menuItemOwnedByUser(menuItemId, req.userId))) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    const jobId = enqueueJob(() =>
      openRouterService.optimizePrice(
        itemName,
        description || '',
        parseFloat(currentPrice),
        category || 'General',
        menuItemId
      )
    );

    res.status(202).json({ jobId, message: 'Price optimization queued. Poll GET /api/ai/jobs/:id for result.' });
  } catch (error: any) {
    console.error('Error queuing price optimization:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Dish recommendations — POST /api/ai/recommend-dishes
// ---------------------------------------------------------------------------

export async function recommendDishes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuId, preferences, dietaryRestrictions, mealType, budget } = req.body;

    if (!menuId) {
      res.status(400).json({ error: 'Menu ID is required' });
      return;
    }

    if (!(await menuOwnedByUser(menuId, req.userId))) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await openRouterService.recommendDishes(
      parseInt(menuId),
      preferences || '',
      dietaryRestrictions || '',
      mealType || '',
      budget || ''
    );

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error recommending dishes:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Healthcare nutrition — POST /api/ai/nutrition-healthcare  (queued — slow)
// Returns { jobId } immediately; poll GET /api/ai/jobs/:id for result.
// ---------------------------------------------------------------------------

export async function nutritionHealthcareQueued(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { itemName, description, healthConditions, menuItemId } = req.body;

    if (!itemName) {
      res.status(400).json({ error: 'Item name is required' });
      return;
    }

    if (menuItemId && !(await menuItemOwnedByUser(menuItemId, req.userId))) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    const jobId = enqueueJob(() =>
      openRouterService.analyzeNutritionHealthcare(
        itemName,
        description || '',
        healthConditions || '',
        menuItemId
      )
    );

    res.status(202).json({ jobId, message: 'Healthcare nutrition analysis queued. Poll GET /api/ai/jobs/:id for result.' });
  } catch (error: any) {
    console.error('Error queuing healthcare nutrition:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Dietary filter recommendations — POST /api/ai/dietary-filter-recommendations
// ---------------------------------------------------------------------------

export async function dietaryFilterRecommendations(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
      return;
    }

    const { menuId, filters, notes } = req.body;
    if (!menuId) {
      res.status(400).json({ error: 'menuId is required' });
      return;
    }

    if (!(await menuOwnedByUser(menuId, req.userId))) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const filterArr = Array.isArray(filters) ? filters : (typeof filters === 'string' ? filters.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const result = await openRouterService.dietaryFilterRecommendations(parseInt(menuId), filterArr, notes || '');
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error in dietary filter recommendations:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Seasonal rotation — POST /api/ai/menu-seasonal-rotation
// ---------------------------------------------------------------------------

export async function menuSeasonalRotation(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
      return;
    }

    const { menuId, season, region } = req.body;
    if (!menuId || !season) {
      res.status(400).json({ error: 'menuId and season are required' });
      return;
    }

    if (!(await menuOwnedByUser(menuId, req.userId))) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await openRouterService.menuSeasonalRotation(parseInt(menuId), season, region || '');
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error in seasonal rotation:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// AI history — GET /api/ai/history
// ---------------------------------------------------------------------------

export async function getAiHistory(req: AuthRequest, res: Response): Promise<void> {
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
}

// ---------------------------------------------------------------------------
// Price suggestions — GET /api/ai/price-suggestions/menu/:menuId
// ---------------------------------------------------------------------------

export async function getPriceSuggestions(req: AuthRequest, res: Response): Promise<void> {
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
}

// ---------------------------------------------------------------------------
// Dish recommendations — GET /api/ai/recommendations/menu/:menuId
// ---------------------------------------------------------------------------

export async function getDishRecommendations(req: AuthRequest, res: Response): Promise<void> {
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
}

// ---------------------------------------------------------------------------
// Delete price suggestion — DELETE /api/ai/price-suggestions/:id
// ---------------------------------------------------------------------------

export async function deletePriceSuggestion(req: AuthRequest, res: Response): Promise<void> {
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
}

// ---------------------------------------------------------------------------
// Delete recommendation — DELETE /api/ai/recommendations/:id
// ---------------------------------------------------------------------------

export async function deleteDishRecommendation(req: AuthRequest, res: Response): Promise<void> {
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
}

// ---------------------------------------------------------------------------
// PDF Menu Analysis — POST /api/ai/analyze-pdf-menu
// Accepts base64-encoded PDF or raw extracted text via pdfText field
// ---------------------------------------------------------------------------

export async function analyzePdfMenu(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { pdfText, pdfBase64, menuId } = req.body;

    // The UI sends base64 PDF bytes as [PDF_BASE64]:<data>; accept a plain
    // pdfBase64 field too, or already-extracted plain text.
    const rawPayload = typeof pdfText === 'string' && pdfText
      ? pdfText
      : (typeof pdfBase64 === 'string' && pdfBase64 ? `${PDF_BASE64_PREFIX}${pdfBase64}` : '');

    if (!rawPayload) {
      res.status(400).json({ error: 'pdfText (extracted text) or pdfBase64 (PDF file) is required' });
      return;
    }

    if (menuId && !(await menuOwnedByUser(menuId, req.userId))) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const extracted = await extractPdfText(rawPayload);
    if (extracted.error || !extracted.text) {
      res.status(422).json({ error: extracted.error || 'Could not extract text from the PDF' });
      return;
    }

    const result = await openRouterService.analyzeMenuPdf(extracted.text, menuId);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error analyzing PDF menu:', error);
    res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Menu Engineer Score — POST /api/ai/menu-engineer-score/:menuId
// ---------------------------------------------------------------------------

export async function menuEngineerScore(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuId } = req.params;

    // Verify menu belongs to this user
    const menuCheck = await pool.query(
      'SELECT id FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );
    if (menuCheck.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await openRouterService.menuEngineerScore(parseInt(menuId));

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true, analysis: result.data, tokensUsed: result.tokensUsed });
  } catch (error: any) {
    console.error('Error calculating menu engineer score:', error);
    res.status(500).json({ error: error.message });
  }
}
