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
try { const _gap_dietary_filter_recommendations = require('./routes/gap-dietary-filter-recommendations'); (app as any).use('/api/gap-dietary-filter-recommendations', _gap_dietary_filter_recommendations.default || _gap_dietary_filter_recommendations); } catch(e) { console.error('gap mount fail dietary-filter-recommendations:', (e as any).message); }
try { const _gap_menu_seasonal_rotation = require('./routes/gap-menu-seasonal-rotation'); (app as any).use('/api/gap-menu-seasonal-rotation', _gap_menu_seasonal_rotation.default || _gap_menu_seasonal_rotation); } catch(e) { console.error('gap mount fail menu-seasonal-rotation:', (e as any).message); }
try { const _gap_guest_preference_personalization = require('./routes/gap-guest-preference-personalization'); (app as any).use('/api/gap-guest-preference-personalization', _gap_guest_preference_personalization.default || _gap_guest_preference_personalization); } catch(e) { console.error('gap mount fail guest-preference-personalization:', (e as any).message); }
try { const _gap_waste_reduction_advisor = require('./routes/gap-waste-reduction-advisor'); (app as any).use('/api/gap-waste-reduction-advisor', _gap_waste_reduction_advisor.default || _gap_waste_reduction_advisor); } catch(e) { console.error('gap mount fail waste-reduction-advisor:', (e as any).message); }
try { const _gap_guest = require('./routes/gap-guest'); (app as any).use('/api/gap-guest', _gap_guest.default || _gap_guest); } catch(e) { console.error('gap mount fail guest:', (e as any).message); }
try { const _gap_qr_code = require('./routes/gap-qr-code'); (app as any).use('/api/gap-qr-code', _gap_qr_code.default || _gap_qr_code); } catch(e) { console.error('gap mount fail qr-code:', (e as any).message); }
try { const _gap_webhooks = require('./routes/gap-webhooks'); (app as any).use('/api/gap-webhooks', _gap_webhooks.default || _gap_webhooks); } catch(e) { console.error('gap mount fail webhooks:', (e as any).message); }
try { const _gap_native = require('./routes/gap-native'); (app as any).use('/api/gap-native', _gap_native.default || _gap_native); } catch(e) { console.error('gap mount fail native:', (e as any).message); }
try { const _gap_supplier = require('./routes/gap-supplier'); (app as any).use('/api/gap-supplier', _gap_supplier.default || _gap_supplier); } catch(e) { console.error('gap mount fail supplier:', (e as any).message); }
try { const _gap_mobile = require('./routes/gap-mobile'); (app as any).use('/api/gap-mobile', _gap_mobile.default || _gap_mobile); } catch(e) { console.error('gap mount fail mobile:', (e as any).message); }
try { const _gap_order = require('./routes/gap-order'); (app as any).use('/api/gap-order', _gap_order.default || _gap_order); } catch(e) { console.error('gap mount fail order:', (e as any).message); }
// === End Batch 05 Mounts ===
