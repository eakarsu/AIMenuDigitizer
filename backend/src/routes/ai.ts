import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { heavyAiLimiter } from '../middleware/rateLimit';
import {
  analyzeImage,
  analyzeText,
  analyzePdfMenu,
  detectAllergens,
  estimateCalories,
  translateMenuItem,
  optimizePriceQueued,
  recommendDishes,
  nutritionHealthcareQueued,
  menuEngineerScore,
  getAiHistory,
  getPriceSuggestions,
  getDishRecommendations,
  deletePriceSuggestion,
  deleteDishRecommendation,
  getJobStatus,
  dietaryFilterRecommendations,
  menuSeasonalRotation
} from '../controllers/aiController';

const router = Router();

// Job status — poll after receiving a jobId from a queued endpoint
router.get('/jobs/:id', authenticateToken, getJobStatus);

// Synchronous AI endpoints
router.post('/analyze-image', authenticateToken, analyzeImage);
router.post('/analyze-text', authenticateToken, analyzeText);
router.post('/analyze-pdf-menu', authenticateToken, analyzePdfMenu);
router.post('/detect-allergens', authenticateToken, detectAllergens);
router.post('/estimate-calories', authenticateToken, estimateCalories);
router.post('/translate', authenticateToken, translateMenuItem);
router.post('/menu-engineer-score/:menuId', authenticateToken, menuEngineerScore);

// Heavy endpoints with stricter rate limiting (5 per hour)
router.post('/recommend-dishes', authenticateToken, heavyAiLimiter, recommendDishes);
router.post('/dietary-filter-recommendations', authenticateToken, heavyAiLimiter, dietaryFilterRecommendations);
router.post('/menu-seasonal-rotation', authenticateToken, heavyAiLimiter, menuSeasonalRotation);

// Queued (slow) AI endpoints — return { jobId } immediately
router.post('/optimize-price', authenticateToken, optimizePriceQueued);
router.post('/nutrition-healthcare', authenticateToken, heavyAiLimiter, nutritionHealthcareQueued);

// History and stored results
router.get('/history', authenticateToken, getAiHistory);
router.get('/price-suggestions/menu/:menuId', authenticateToken, getPriceSuggestions);
router.get('/recommendations/menu/:menuId', authenticateToken, getDishRecommendations);
router.delete('/price-suggestions/:id', authenticateToken, deletePriceSuggestion);
router.delete('/recommendations/:id', authenticateToken, deleteDishRecommendation);

export default router;
