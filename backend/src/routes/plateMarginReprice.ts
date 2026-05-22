import express from 'express';

const router = express.Router();

router.post('/analyze', (req, res) => {
  const { menuItems = [], targetFoodCostPct = 32, laborPct = 18, wastePct = 4 } = req.body || {};
  const items = Array.isArray(menuItems) ? menuItems : [];
  const analyzed = items.map((item: any) => {
    const ingredientCost = Number(item.ingredientCost || 0);
    const currentPrice = Math.max(Number(item.currentPrice || 0), 0.01);
    const sales = Number(item.weeklySales || 0);
    const loadedCost = ingredientCost * (1 + Number(wastePct) / 100) + currentPrice * (Number(laborPct) / 100);
    const targetPrice = loadedCost / (Number(targetFoodCostPct) / 100);
    const marginGap = targetPrice - currentPrice;
    return {
      name: item.name || 'Menu item',
      currentPrice: Number(currentPrice.toFixed(2)),
      targetPrice: Number(targetPrice.toFixed(2)),
      weeklySales: sales,
      marginGap: Number(marginGap.toFixed(2)),
      priority: Math.abs(marginGap) * Math.max(1, sales),
      action: marginGap > 1 ? 'raise price' : marginGap < -1 ? 'promote or hold' : 'within band',
    };
  }).sort((a, b) => b.priority - a.priority);

  res.json({
    feature: 'Plate Margin Reprice',
    targetFoodCostPct: Number(targetFoodCostPct),
    portfolioGap: Number(analyzed.reduce((sum, item) => sum + item.marginGap * item.weeklySales, 0).toFixed(2)),
    recommendations: analyzed.slice(0, 12),
  });
});

export default router;
