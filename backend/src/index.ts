import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import aiRoutes from './routes/ai';
import allergenRoutes from './routes/allergens';
import calorieRoutes from './routes/calories';
import translationRoutes from './routes/translations';
import exportRoutes from './routes/export';
// Apply pass 5 — additive routes (locations, staff RBAC, ingredient costs,
// AI cost analysis, POS/delivery integrations).
import locationsRoutes from './routes/locations';
import staffRoutes from './routes/staff';
import ingredientCostsRoutes from './routes/ingredientCosts';
import aiCostAnalysisRoutes from './routes/aiCostAnalysis';
import integrationsRoutes from './routes/integrations';
import plateMarginRepriceRoutes from './routes/plateMarginReprice';
import menuWorkflowRoutes from './routes/menuWorkflow';
import guestOpsRoutes from './routes/guestOps';

// === BATCH 05 AUTO-MOUNT imports ===
import visionMenuIntelRouter from './routes/vision-menu-intel';
import menuOptimizationAgentRouter from './routes/menu-optimization-agent';
import dietaryComplianceStreamRouter from './routes/dietary-compliance-stream';
import multiLanguageMenuRouter from './routes/multi-language-menu';
import inventoryMenuLinkRouter from './routes/inventory-menu-link';

import { generalLimiter, authLimiter } from './middleware/rateLimit';

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(generalLimiter);

// Middleware
app.use(cors({
  origin: `http://localhost:${process.env.FRONTEND_PORT || 3000}`,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/allergens', allergenRoutes);
app.use('/api/calories', calorieRoutes);
app.use('/api/translations', translationRoutes);
app.use('/api/export', exportRoutes);

// Apply pass 5 — additive routes
app.use('/api/locations', locationsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/ingredient-costs', ingredientCostsRoutes);
app.use('/api/ai', aiCostAnalysisRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/plate-margin-reprice', plateMarginRepriceRoutes);
app.use('/api/menu-workflow', menuWorkflowRoutes);
app.use('/api/guest-ops', guestOpsRoutes);

app.use(/^\/api\/(?:gap-|vision-menu-intel|menu-optimization-agent|dietary-compliance-stream|multi-language-menu|inventory-menu-link)/, (req, res, next) => {
  if (process.env.ENABLE_EXPERIMENTAL_ROUTES === 'true') return next();
  return res.status(501).json({ error: 'Generated/provider-backed surface is quarantined', required: 'ENABLE_EXPERIMENTAL_ROUTES=true plus documented provider configuration' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

// === Custom Views (bespoke menu analytics) ===
try {
  const customViewsRouter = require('./routes/customViews');
  (app as any).use('/api/custom-views', customViewsRouter.default || customViewsRouter);
  console.log('Mounted /api/custom-views');
} catch (e: any) {
  console.error('custom-views mount fail:', e.message);
}

// === BATCH 05 AUTO-MOUNT (custom feature suggestions) ===
app.use('/api/vision-menu-intel', visionMenuIntelRouter);
app.use('/api/menu-optimization-agent', menuOptimizationAgentRouter);
app.use('/api/dietary-compliance-stream', dietaryComplianceStreamRouter);
app.use('/api/multi-language-menu', multiLanguageMenuRouter);
app.use('/api/inventory-menu-link', inventoryMenuLinkRouter);

// === Batch 05 Gaps & Frontend Mounts ===
// === End Batch 05 Mounts ===
