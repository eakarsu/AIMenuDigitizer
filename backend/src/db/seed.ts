import pool from './connection';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('Seeding database with sample data...');

    // Clear existing data
    await pool.query('TRUNCATE users, menus, menu_items, allergens, nutrition, translations, ai_analysis, price_suggestions, dish_recommendations, token_blacklist RESTART IDENTITY CASCADE');

    // Create demo user (admin, email verified)
    const hashedPassword = await bcrypt.hash('demo123456', 10);
    const userResult = await pool.query(
      `INSERT INTO users (email, password, name, role, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['demo@menudigitizer.com', hashedPassword, 'Demo User', 'admin', true]
    );
    const userId = userResult.rows[0].id;

    // Create 15 additional users (5 admin, 5 manager, 5 viewer)
    const additionalUsers = [
      { email: 'admin1@menudigitizer.com', name: 'Alice Admin', role: 'admin', verified: true },
      { email: 'admin2@menudigitizer.com', name: 'Bob Admin', role: 'admin', verified: true },
      { email: 'admin3@menudigitizer.com', name: 'Carol Admin', role: 'admin', verified: true },
      { email: 'admin4@menudigitizer.com', name: 'Dave Admin', role: 'admin', verified: false },
      { email: 'admin5@menudigitizer.com', name: 'Eve Admin', role: 'admin', verified: true },
      { email: 'mgr1@menudigitizer.com', name: 'Frank Manager', role: 'manager', verified: true },
      { email: 'mgr2@menudigitizer.com', name: 'Grace Manager', role: 'manager', verified: true },
      { email: 'mgr3@menudigitizer.com', name: 'Henry Manager', role: 'manager', verified: false },
      { email: 'mgr4@menudigitizer.com', name: 'Ivy Manager', role: 'manager', verified: true },
      { email: 'mgr5@menudigitizer.com', name: 'Jack Manager', role: 'manager', verified: false },
      { email: 'view1@menudigitizer.com', name: 'Kate Viewer', role: 'viewer', verified: true },
      { email: 'view2@menudigitizer.com', name: 'Leo Viewer', role: 'viewer', verified: false },
      { email: 'view3@menudigitizer.com', name: 'Mia Viewer', role: 'viewer', verified: true },
      { email: 'view4@menudigitizer.com', name: 'Nick Viewer', role: 'viewer', verified: false },
      { email: 'view5@menudigitizer.com', name: 'Olivia Viewer', role: 'viewer', verified: true },
    ];

    for (const u of additionalUsers) {
      const pw = await bcrypt.hash('password123', 10);
      await pool.query(
        `INSERT INTO users (email, password, name, role, email_verified) VALUES ($1, $2, $3, $4, $5)`,
        [u.email, pw, u.name, u.role, u.verified]
      );
    }

    // Add 15 expired token_blacklist entries for demo purposes
    for (let i = 0; i < 15; i++) {
      await pool.query(
        `INSERT INTO token_blacklist (token, user_id, expires_at) VALUES ($1, $2, $3)`,
        [`expired_token_${i}_${Date.now()}`, userId, new Date(Date.now() - 86400000)]
      );
    }

    // Create sample menus (15 different restaurants)
    const menus = [
      { name: 'Main Menu', restaurant: 'Bella Italia Restaurant', description: 'Authentic Italian cuisine with fresh ingredients' },
      { name: 'Lunch Specials', restaurant: 'Tokyo Garden', description: 'Traditional Japanese dishes and sushi' },
      { name: 'Dinner Menu', restaurant: 'Spice Route', description: 'Indian and Asian fusion cuisine' },
      { name: 'Brunch Menu', restaurant: 'Le Petit Bistro', description: 'French-inspired brunch and pastries' },
      { name: 'Tapas Menu', restaurant: 'Casa de Tapas', description: 'Spanish small plates and wines' },
      { name: 'BBQ Menu', restaurant: 'Smokey Joe\'s BBQ', description: 'Slow-smoked meats and Southern sides' },
      { name: 'Seafood Menu', restaurant: 'The Catch', description: 'Fresh seafood and coastal cuisine' },
      { name: 'Vegan Menu', restaurant: 'Green Plate Kitchen', description: 'Plant-based dishes and organic juices' },
      { name: 'Steakhouse Menu', restaurant: 'Prime Cut Steakhouse', description: 'Premium steaks and classic sides' },
      { name: 'Dim Sum Menu', restaurant: 'Golden Dragon', description: 'Traditional Cantonese dim sum' },
      { name: 'Mediterranean Menu', restaurant: 'Olive & Vine', description: 'Mediterranean flavors and fresh ingredients' },
      { name: 'Mexican Menu', restaurant: 'El Fuego Cantina', description: 'Authentic Mexican street food and margaritas' },
      { name: 'Dessert Menu', restaurant: 'Sugar & Spice', description: 'Artisan desserts and specialty coffees' },
      { name: 'Wine Bar Menu', restaurant: 'The Vineyard', description: 'Small plates paired with curated wines' },
      { name: 'Food Truck Menu', restaurant: 'Rolling Bites', description: 'Gourmet street food on wheels' }
    ];

    const menuIds: number[] = [];
    for (const menu of menus) {
      const result = await pool.query(
        `INSERT INTO menus (name, restaurant_name, description, user_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [menu.name, menu.restaurant, menu.description, userId]
      );
      menuIds.push(result.rows[0].id);
    }

    // Extensive menu items (at least 15 for each menu)
    const menuItems = [
      // Bella Italia Restaurant (menuIds[0])
      { menu_id: menuIds[0], name: 'Margherita Pizza', description: 'Classic pizza with fresh mozzarella, tomatoes, and basil', price: 14.99, category: 'Pizza', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Spaghetti Carbonara', description: 'Creamy pasta with pancetta, egg, and parmesan', price: 16.99, category: 'Pasta', is_vegetarian: false },
      { menu_id: menuIds[0], name: 'Lasagna Bolognese', description: 'Layered pasta with meat sauce and bechamel', price: 18.99, category: 'Pasta', is_vegetarian: false },
      { menu_id: menuIds[0], name: 'Risotto ai Funghi', description: 'Creamy risotto with mixed wild mushrooms', price: 17.99, category: 'Rice', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Osso Buco', description: 'Braised veal shanks with gremolata', price: 28.99, category: 'Main Course', is_vegetarian: false },
      { menu_id: menuIds[0], name: 'Caprese Salad', description: 'Fresh mozzarella, tomatoes, and basil with balsamic', price: 12.99, category: 'Salad', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Bruschetta', description: 'Toasted bread with tomatoes, garlic, and olive oil', price: 9.99, category: 'Appetizer', is_vegetarian: true, is_vegan: true },
      { menu_id: menuIds[0], name: 'Tiramisu', description: 'Classic Italian dessert with coffee and mascarpone', price: 8.99, category: 'Dessert', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Panna Cotta', description: 'Vanilla cream dessert with berry sauce', price: 7.99, category: 'Dessert', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Chicken Parmigiana', description: 'Breaded chicken with tomato sauce and mozzarella', price: 19.99, category: 'Main Course', is_vegetarian: false },
      { menu_id: menuIds[0], name: 'Fettuccine Alfredo', description: 'Creamy pasta with parmesan cheese sauce', price: 15.99, category: 'Pasta', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Minestrone Soup', description: 'Hearty vegetable soup with pasta', price: 8.99, category: 'Soup', is_vegetarian: true, is_vegan: true },
      { menu_id: menuIds[0], name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter sauce', price: 24.99, category: 'Seafood', is_vegetarian: false },
      { menu_id: menuIds[0], name: 'Eggplant Parmesan', description: 'Breaded eggplant with marinara and cheese', price: 16.99, category: 'Main Course', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Cannoli', description: 'Crispy pastry shells with sweet ricotta filling', price: 6.99, category: 'Dessert', is_vegetarian: true },
      { menu_id: menuIds[0], name: 'Prosciutto e Melone', description: 'Cured ham with fresh cantaloupe melon', price: 11.99, category: 'Appetizer', is_vegetarian: false },
      { menu_id: menuIds[0], name: 'Gnocchi al Pesto', description: 'Potato dumplings with fresh basil pesto', price: 14.99, category: 'Pasta', is_vegetarian: true },

      // Tokyo Garden (menuIds[1])
      { menu_id: menuIds[1], name: 'Salmon Sashimi', description: 'Fresh sliced salmon, 8 pieces', price: 18.99, category: 'Sashimi', is_vegetarian: false, is_gluten_free: true },
      { menu_id: menuIds[1], name: 'Dragon Roll', description: 'Eel and cucumber topped with avocado', price: 16.99, category: 'Sushi Roll', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Vegetable Tempura', description: 'Assorted vegetables in light crispy batter', price: 12.99, category: 'Appetizer', is_vegetarian: true },
      { menu_id: menuIds[1], name: 'Chicken Teriyaki', description: 'Grilled chicken with teriyaki sauce and rice', price: 17.99, category: 'Main Course', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Miso Soup', description: 'Traditional soybean soup with tofu and seaweed', price: 4.99, category: 'Soup', is_vegetarian: true, is_vegan: true },
      { menu_id: menuIds[1], name: 'Edamame', description: 'Steamed soybeans with sea salt', price: 5.99, category: 'Appetizer', is_vegetarian: true, is_vegan: true, is_gluten_free: true },
      { menu_id: menuIds[1], name: 'Spicy Tuna Roll', description: 'Tuna with spicy mayo and cucumber', price: 14.99, category: 'Sushi Roll', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Beef Ramen', description: 'Rich broth with noodles, beef, and soft egg', price: 16.99, category: 'Noodles', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Gyoza', description: 'Pan-fried pork dumplings, 6 pieces', price: 8.99, category: 'Appetizer', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'California Roll', description: 'Crab, avocado, and cucumber', price: 12.99, category: 'Sushi Roll', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Tonkatsu', description: 'Breaded pork cutlet with cabbage and sauce', price: 18.99, category: 'Main Course', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Green Tea Ice Cream', description: 'Traditional matcha flavored ice cream', price: 5.99, category: 'Dessert', is_vegetarian: true },
      { menu_id: menuIds[1], name: 'Udon Noodle Soup', description: 'Thick wheat noodles in savory broth', price: 14.99, category: 'Noodles', is_vegetarian: true },
      { menu_id: menuIds[1], name: 'Seaweed Salad', description: 'Marinated seaweed with sesame', price: 6.99, category: 'Salad', is_vegetarian: true, is_vegan: true },
      { menu_id: menuIds[1], name: 'Rainbow Roll', description: 'California roll topped with assorted fish', price: 19.99, category: 'Sushi Roll', is_vegetarian: false },
      { menu_id: menuIds[1], name: 'Agedashi Tofu', description: 'Deep fried tofu in dashi broth', price: 7.99, category: 'Appetizer', is_vegetarian: true, is_vegan: true },
      { menu_id: menuIds[1], name: 'Salmon Teriyaki', description: 'Grilled salmon with teriyaki glaze', price: 21.99, category: 'Main Course', is_vegetarian: false },

      // Spice Route (menuIds[2])
      { menu_id: menuIds[2], name: 'Butter Chicken', description: 'Creamy tomato curry with tender chicken', price: 17.99, category: 'Curry', is_vegetarian: false, spice_level: 2 },
      { menu_id: menuIds[2], name: 'Palak Paneer', description: 'Spinach curry with cottage cheese cubes', price: 15.99, category: 'Curry', is_vegetarian: true, spice_level: 1 },
      { menu_id: menuIds[2], name: 'Chicken Tikka Masala', description: 'Grilled chicken in spiced masala sauce', price: 18.99, category: 'Curry', is_vegetarian: false, spice_level: 2 },
      { menu_id: menuIds[2], name: 'Lamb Biryani', description: 'Fragrant rice with spiced lamb and saffron', price: 21.99, category: 'Rice', is_vegetarian: false, spice_level: 2 },
      { menu_id: menuIds[2], name: 'Vegetable Samosas', description: 'Crispy pastries with spiced potato filling', price: 7.99, category: 'Appetizer', is_vegetarian: true, is_vegan: true, spice_level: 1 },
      { menu_id: menuIds[2], name: 'Naan Bread', description: 'Traditional Indian flatbread from tandoor', price: 3.99, category: 'Bread', is_vegetarian: true },
      { menu_id: menuIds[2], name: 'Garlic Naan', description: 'Naan bread with roasted garlic and butter', price: 4.99, category: 'Bread', is_vegetarian: true },
      { menu_id: menuIds[2], name: 'Tandoori Chicken', description: 'Marinated chicken roasted in clay oven', price: 19.99, category: 'Main Course', is_vegetarian: false, spice_level: 2 },
      { menu_id: menuIds[2], name: 'Dal Makhani', description: 'Creamy black lentils slow-cooked overnight', price: 13.99, category: 'Curry', is_vegetarian: true, spice_level: 1 },
      { menu_id: menuIds[2], name: 'Mango Lassi', description: 'Sweet yogurt drink with mango', price: 5.99, category: 'Beverage', is_vegetarian: true },
      { menu_id: menuIds[2], name: 'Pad Thai', description: 'Stir-fried rice noodles with shrimp and peanuts', price: 16.99, category: 'Noodles', is_vegetarian: false, spice_level: 1 },
      { menu_id: menuIds[2], name: 'Green Curry', description: 'Thai coconut curry with vegetables', price: 15.99, category: 'Curry', is_vegetarian: true, is_vegan: true, spice_level: 3 },
      { menu_id: menuIds[2], name: 'Vindaloo', description: 'Hot and tangy Goan curry with potatoes', price: 18.99, category: 'Curry', is_vegetarian: false, spice_level: 4 },
      { menu_id: menuIds[2], name: 'Gulab Jamun', description: 'Sweet milk dumplings in rose syrup', price: 6.99, category: 'Dessert', is_vegetarian: true },
      { menu_id: menuIds[2], name: 'Raita', description: 'Cool yogurt with cucumber and mint', price: 4.99, category: 'Side', is_vegetarian: true, is_gluten_free: true },
      { menu_id: menuIds[2], name: 'Chicken Korma', description: 'Mild creamy curry with almonds', price: 18.99, category: 'Curry', is_vegetarian: false, spice_level: 1 },
      { menu_id: menuIds[2], name: 'Aloo Gobi', description: 'Spiced potatoes and cauliflower', price: 12.99, category: 'Curry', is_vegetarian: true, is_vegan: true, spice_level: 2 }
    ];

    const itemIds: number[] = [];
    for (const item of menuItems) {
      const result = await pool.query(
        `INSERT INTO menu_items (menu_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free, spice_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [item.menu_id, item.name, item.description, item.price, item.category,
         item.is_vegetarian || false, item.is_vegan || false, item.is_gluten_free || false, item.spice_level || 0]
      );
      itemIds.push(result.rows[0].id);
    }

    // Add allergens for menu items (at least 15 different allergen entries)
    const allergens = [
      { item_idx: 0, name: 'Gluten', severity: 'high', description: 'Contains wheat flour in pizza dough' },
      { item_idx: 0, name: 'Dairy', severity: 'high', description: 'Contains mozzarella cheese' },
      { item_idx: 1, name: 'Gluten', severity: 'high', description: 'Contains wheat pasta' },
      { item_idx: 1, name: 'Eggs', severity: 'high', description: 'Contains raw egg in sauce' },
      { item_idx: 1, name: 'Dairy', severity: 'moderate', description: 'Contains parmesan cheese' },
      { item_idx: 2, name: 'Gluten', severity: 'high', description: 'Contains wheat pasta sheets' },
      { item_idx: 2, name: 'Dairy', severity: 'high', description: 'Contains bechamel sauce' },
      { item_idx: 3, name: 'Dairy', severity: 'high', description: 'Contains butter and parmesan' },
      { item_idx: 7, name: 'Dairy', severity: 'high', description: 'Contains mascarpone cheese' },
      { item_idx: 7, name: 'Eggs', severity: 'moderate', description: 'Contains raw eggs' },
      { item_idx: 7, name: 'Gluten', severity: 'moderate', description: 'Contains ladyfinger cookies' },
      { item_idx: 8, name: 'Dairy', severity: 'high', description: 'Contains heavy cream' },
      { item_idx: 10, name: 'Dairy', severity: 'high', description: 'Contains cream and parmesan' },
      { item_idx: 10, name: 'Gluten', severity: 'high', description: 'Contains wheat pasta' },
      { item_idx: 12, name: 'Fish', severity: 'high', description: 'Contains salmon' },
      { item_idx: 14, name: 'Dairy', severity: 'high', description: 'Contains ricotta cheese' },
      { item_idx: 14, name: 'Gluten', severity: 'high', description: 'Contains pastry shell' },
      { item_idx: 17, name: 'Fish', severity: 'high', description: 'Contains raw salmon' },
      { item_idx: 18, name: 'Fish', severity: 'high', description: 'Contains eel' },
      { item_idx: 18, name: 'Gluten', severity: 'moderate', description: 'Contains soy sauce' },
      { item_idx: 19, name: 'Gluten', severity: 'high', description: 'Contains wheat flour batter' },
      { item_idx: 20, name: 'Soy', severity: 'moderate', description: 'Contains soy sauce' },
      { item_idx: 22, name: 'Soy', severity: 'moderate', description: 'Contains soy sauce' },
      { item_idx: 23, name: 'Fish', severity: 'high', description: 'Contains tuna' },
      { item_idx: 25, name: 'Gluten', severity: 'high', description: 'Contains pork dumplings' },
      { item_idx: 26, name: 'Shellfish', severity: 'high', description: 'Contains crab meat' },
      { item_idx: 34, name: 'Dairy', severity: 'high', description: 'Contains cream and butter' },
      { item_idx: 34, name: 'Tree Nuts', severity: 'moderate', description: 'May contain cashews' },
      { item_idx: 35, name: 'Dairy', severity: 'high', description: 'Contains paneer cheese' },
      { item_idx: 37, name: 'Gluten', severity: 'high', description: 'Contains wheat flour' },
      { item_idx: 38, name: 'Gluten', severity: 'high', description: 'Contains wheat flour naan' },
      { item_idx: 44, name: 'Peanuts', severity: 'high', description: 'Contains peanuts' },
      { item_idx: 44, name: 'Shellfish', severity: 'high', description: 'Contains shrimp' },
      { item_idx: 49, name: 'Tree Nuts', severity: 'high', description: 'Contains almonds' }
    ];

    for (const allergen of allergens) {
      if (itemIds[allergen.item_idx]) {
        await pool.query(
          `INSERT INTO allergens (menu_item_id, name, severity, description) VALUES ($1, $2, $3, $4)`,
          [itemIds[allergen.item_idx], allergen.name, allergen.severity, allergen.description]
        );
      }
    }

    // Add nutrition info for menu items (at least 15 entries)
    const nutritionData = [
      { item_idx: 0, calories: 850, protein: 32, carbs: 98, fat: 36, fiber: 4, sodium: 1200, sugar: 8, serving: '1 pizza (12 inch)' },
      { item_idx: 1, calories: 720, protein: 28, carbs: 65, fat: 38, fiber: 3, sodium: 980, sugar: 4, serving: '1 plate (350g)' },
      { item_idx: 2, calories: 890, protein: 42, carbs: 72, fat: 48, fiber: 5, sodium: 1450, sugar: 12, serving: '1 portion (400g)' },
      { item_idx: 3, calories: 580, protein: 18, carbs: 68, fat: 26, fiber: 3, sodium: 890, sugar: 2, serving: '1 bowl (300g)' },
      { item_idx: 4, calories: 650, protein: 45, carbs: 15, fat: 42, fiber: 2, sodium: 1100, sugar: 3, serving: '1 serving' },
      { item_idx: 5, calories: 280, protein: 14, carbs: 8, fat: 22, fiber: 2, sodium: 420, sugar: 6, serving: '1 plate' },
      { item_idx: 6, calories: 180, protein: 4, carbs: 24, fat: 8, fiber: 2, sodium: 380, sugar: 4, serving: '4 pieces' },
      { item_idx: 7, calories: 450, protein: 8, carbs: 42, fat: 28, fiber: 1, sodium: 180, sugar: 32, serving: '1 slice' },
      { item_idx: 8, calories: 320, protein: 5, carbs: 28, fat: 22, fiber: 0, sodium: 85, sugar: 24, serving: '1 serving' },
      { item_idx: 9, calories: 620, protein: 38, carbs: 42, fat: 32, fiber: 3, sodium: 1250, sugar: 8, serving: '1 serving' },
      { item_idx: 10, calories: 680, protein: 22, carbs: 58, fat: 40, fiber: 2, sodium: 920, sugar: 4, serving: '1 plate' },
      { item_idx: 11, calories: 165, protein: 8, carbs: 28, fat: 3, fiber: 6, sodium: 680, sugar: 8, serving: '1 bowl' },
      { item_idx: 12, calories: 420, protein: 38, carbs: 5, fat: 28, fiber: 0, sodium: 520, sugar: 2, serving: '1 fillet' },
      { item_idx: 13, calories: 540, protein: 18, carbs: 45, fat: 32, fiber: 8, sodium: 980, sugar: 12, serving: '1 serving' },
      { item_idx: 14, calories: 280, protein: 6, carbs: 32, fat: 14, fiber: 1, sodium: 120, sugar: 18, serving: '2 pieces' },
      { item_idx: 17, calories: 220, protein: 26, carbs: 2, fat: 12, fiber: 0, sodium: 95, sugar: 0, serving: '8 pieces' },
      { item_idx: 18, calories: 540, protein: 22, carbs: 48, fat: 28, fiber: 3, sodium: 1100, sugar: 12, serving: '1 roll (8 pieces)' },
      { item_idx: 19, calories: 320, protein: 6, carbs: 38, fat: 16, fiber: 4, sodium: 280, sugar: 2, serving: '1 plate' },
      { item_idx: 20, calories: 480, protein: 32, carbs: 42, fat: 18, fiber: 2, sodium: 1250, sugar: 16, serving: '1 plate with rice' },
      { item_idx: 21, calories: 85, protein: 6, carbs: 8, fat: 3, fiber: 2, sodium: 680, sugar: 2, serving: '1 bowl' },
      { item_idx: 22, calories: 120, protein: 11, carbs: 10, fat: 4, fiber: 4, sodium: 9, sugar: 1, serving: '1 cup' },
      { item_idx: 23, calories: 380, protein: 18, carbs: 42, fat: 15, fiber: 2, sodium: 890, sugar: 6, serving: '1 roll' },
      { item_idx: 24, calories: 520, protein: 35, carbs: 58, fat: 16, fiber: 3, sodium: 1850, sugar: 4, serving: '1 bowl' },
      { item_idx: 25, calories: 280, protein: 12, carbs: 28, fat: 14, fiber: 1, sodium: 620, sugar: 2, serving: '6 pieces' },
      { item_idx: 26, calories: 350, protein: 12, carbs: 38, fat: 16, fiber: 3, sodium: 580, sugar: 4, serving: '1 roll' },
      { item_idx: 34, calories: 620, protein: 28, carbs: 48, fat: 36, fiber: 4, sodium: 1180, sugar: 8, serving: '1 serving with rice' },
      { item_idx: 35, calories: 380, protein: 16, carbs: 32, fat: 22, fiber: 6, sodium: 720, sugar: 4, serving: '1 bowl' },
      { item_idx: 36, calories: 680, protein: 34, carbs: 52, fat: 38, fiber: 3, sodium: 1350, sugar: 12, serving: '1 serving with rice' },
      { item_idx: 37, calories: 720, protein: 32, carbs: 85, fat: 28, fiber: 4, sodium: 980, sugar: 6, serving: '1 serving' },
      { item_idx: 38, calories: 280, protein: 8, carbs: 42, fat: 8, fiber: 2, sodium: 520, sugar: 3, serving: '2 pieces' },
      { item_idx: 44, calories: 520, protein: 22, carbs: 58, fat: 24, fiber: 4, sodium: 980, sugar: 14, serving: '1 plate' },
      { item_idx: 45, calories: 420, protein: 12, carbs: 32, fat: 28, fiber: 4, sodium: 780, sugar: 6, serving: '1 bowl' }
    ];

    for (const nutrition of nutritionData) {
      if (itemIds[nutrition.item_idx]) {
        await pool.query(
          `INSERT INTO nutrition (menu_item_id, calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [itemIds[nutrition.item_idx], nutrition.calories, nutrition.protein, nutrition.carbs,
           nutrition.fat, nutrition.fiber, nutrition.sodium, nutrition.sugar, nutrition.serving]
        );
      }
    }

    // Add translations for menu items (at least 15 entries)
    const translations = [
      { item_idx: 0, lang_code: 'es', lang_name: 'Spanish', name: 'Pizza Margherita', desc: 'Pizza clasica con mozzarella fresca, tomates y albahaca' },
      { item_idx: 0, lang_code: 'fr', lang_name: 'French', name: 'Pizza Margherita', desc: 'Pizza classique avec mozzarella fraiche, tomates et basilic' },
      { item_idx: 0, lang_code: 'de', lang_name: 'German', name: 'Pizza Margherita', desc: 'Klassische Pizza mit frischem Mozzarella, Tomaten und Basilikum' },
      { item_idx: 1, lang_code: 'es', lang_name: 'Spanish', name: 'Espaguetis a la Carbonara', desc: 'Pasta cremosa con panceta, huevo y parmesano' },
      { item_idx: 1, lang_code: 'de', lang_name: 'German', name: 'Spaghetti Carbonara', desc: 'Cremige Pasta mit Speck, Ei und Parmesan' },
      { item_idx: 1, lang_code: 'zh', lang_name: 'Chinese', name: '培根蛋面', desc: '奶油意面配培根、鸡蛋和帕尔马干酪' },
      { item_idx: 7, lang_code: 'it', lang_name: 'Italian', name: 'Tiramisu', desc: 'Classico dolce italiano con caffe e mascarpone' },
      { item_idx: 7, lang_code: 'ja', lang_name: 'Japanese', name: 'ティラミス', desc: 'コーヒーとマスカルポーネを使ったイタリアの定番デザート' },
      { item_idx: 17, lang_code: 'es', lang_name: 'Spanish', name: 'Sashimi de Salmon', desc: 'Salmon fresco en lonchas, 8 piezas' },
      { item_idx: 17, lang_code: 'zh', lang_name: 'Chinese', name: '三文鱼刺身', desc: '新鲜切片三文鱼，8片' },
      { item_idx: 17, lang_code: 'ko', lang_name: 'Korean', name: '연어 사시미', desc: '신선한 연어 슬라이스, 8피스' },
      { item_idx: 19, lang_code: 'es', lang_name: 'Spanish', name: 'Tempura de Verduras', desc: 'Verduras variadas en masa crujiente ligera' },
      { item_idx: 20, lang_code: 'es', lang_name: 'Spanish', name: 'Pollo Teriyaki', desc: 'Pollo a la parrilla con salsa teriyaki y arroz' },
      { item_idx: 20, lang_code: 'ko', lang_name: 'Korean', name: '치킨 데리야끼', desc: '데리야끼 소스를 곁들인 그릴 치킨과 밥' },
      { item_idx: 34, lang_code: 'es', lang_name: 'Spanish', name: 'Pollo con Mantequilla', desc: 'Curry cremoso de tomate con pollo tierno' },
      { item_idx: 34, lang_code: 'hi', lang_name: 'Hindi', name: 'मक्खन चिकन', desc: 'मलाईदार टमाटर करी के साथ नरम चिकन' },
      { item_idx: 34, lang_code: 'ar', lang_name: 'Arabic', name: 'دجاج بالزبدة', desc: 'كاري طماطم كريمي مع دجاج طري' },
      { item_idx: 35, lang_code: 'es', lang_name: 'Spanish', name: 'Palak Paneer', desc: 'Curry de espinacas con cubos de queso fresco' },
      { item_idx: 36, lang_code: 'es', lang_name: 'Spanish', name: 'Pollo Tikka Masala', desc: 'Pollo a la parrilla en salsa masala especiada' },
      { item_idx: 37, lang_code: 'es', lang_name: 'Spanish', name: 'Biryani de Cordero', desc: 'Arroz fragante con cordero especiado y azafran' },
      { item_idx: 44, lang_code: 'th', lang_name: 'Thai', name: 'ผัดไทย', desc: 'ก๋วยเตี๋ยวผัดกับกุ้งและถั่วลิสง' },
      { item_idx: 45, lang_code: 'th', lang_name: 'Thai', name: 'แกงเขียวหวาน', desc: 'แกงกะทิไทยกับผัก' }
    ];

    for (const translation of translations) {
      if (itemIds[translation.item_idx]) {
        await pool.query(
          `INSERT INTO translations (menu_item_id, language_code, language_name, translated_name, translated_description)
           VALUES ($1, $2, $3, $4, $5)`,
          [itemIds[translation.item_idx], translation.lang_code, translation.lang_name, translation.name, translation.desc]
        );
      }
    }

    // Add sample price suggestions (15+ entries)
    const priceSuggestions = [
      { item_idx: 0, suggested: 15.99, min: 13.99, max: 17.99, confidence: 85, reasoning: 'Market analysis suggests slight price increase due to high demand', demand: 'High' },
      { item_idx: 1, suggested: 17.99, min: 15.99, max: 19.99, confidence: 82, reasoning: 'Premium ingredients justify higher pricing', demand: 'High' },
      { item_idx: 4, suggested: 32.99, min: 28.99, max: 35.99, confidence: 78, reasoning: 'Premium cut warrants premium pricing', demand: 'Medium' },
      { item_idx: 7, suggested: 9.99, min: 7.99, max: 11.99, confidence: 88, reasoning: 'Classic dessert with consistent demand', demand: 'High' },
      { item_idx: 12, suggested: 26.99, min: 23.99, max: 29.99, confidence: 80, reasoning: 'Fresh seafood commands premium prices', demand: 'High' },
      { item_idx: 17, suggested: 21.99, min: 18.99, max: 24.99, confidence: 85, reasoning: 'High-quality sashimi grade salmon', demand: 'High' },
      { item_idx: 18, suggested: 18.99, min: 15.99, max: 21.99, confidence: 82, reasoning: 'Popular specialty roll', demand: 'High' },
      { item_idx: 24, suggested: 18.99, min: 15.99, max: 21.99, confidence: 79, reasoning: 'Hearty portion size justifies increase', demand: 'Medium' },
      { item_idx: 34, suggested: 19.99, min: 16.99, max: 22.99, confidence: 87, reasoning: 'Signature dish with loyal customer base', demand: 'High' },
      { item_idx: 36, suggested: 20.99, min: 17.99, max: 23.99, confidence: 84, reasoning: 'Popular curry dish', demand: 'High' },
      { item_idx: 37, suggested: 23.99, min: 20.99, max: 26.99, confidence: 81, reasoning: 'Labor-intensive dish with premium ingredients', demand: 'Medium' },
      { item_idx: 44, suggested: 18.99, min: 15.99, max: 21.99, confidence: 86, reasoning: 'Classic Thai dish with consistent orders', demand: 'High' },
      { item_idx: 45, suggested: 17.99, min: 14.99, max: 20.99, confidence: 83, reasoning: 'Popular vegetarian option', demand: 'High' },
      { item_idx: 3, suggested: 19.99, min: 16.99, max: 22.99, confidence: 80, reasoning: 'Premium risotto with specialty mushrooms', demand: 'Medium' },
      { item_idx: 9, suggested: 21.99, min: 18.99, max: 24.99, confidence: 82, reasoning: 'Generous portion with quality ingredients', demand: 'High' }
    ];

    for (const ps of priceSuggestions) {
      if (itemIds[ps.item_idx]) {
        const item = menuItems[ps.item_idx];
        await pool.query(
          `INSERT INTO price_suggestions (menu_item_id, current_price, suggested_price, min_price, max_price, confidence, reasoning, demand_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [itemIds[ps.item_idx], item.price, ps.suggested, ps.min, ps.max, ps.confidence, ps.reasoning, ps.demand]
        );
      }
    }

    // Add sample dish recommendations (15+ entries)
    const recommendations = [
      { menu_id: menuIds[0], prefs: 'Love Italian food', restrictions: 'None', items: JSON.stringify([{item_name: 'Margherita Pizza', rank: 1}, {item_name: 'Tiramisu', rank: 2}]), reasoning: 'Classic Italian choices', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[0], prefs: 'Vegetarian', restrictions: 'Vegetarian', items: JSON.stringify([{item_name: 'Risotto ai Funghi', rank: 1}, {item_name: 'Caprese Salad', rank: 2}]), reasoning: 'Best vegetarian options', meal: 'Lunch', budget: 'Moderate' },
      { menu_id: menuIds[0], prefs: 'Seafood lover', restrictions: 'None', items: JSON.stringify([{item_name: 'Grilled Salmon', rank: 1}]), reasoning: 'Fresh seafood selection', meal: 'Dinner', budget: 'Premium' },
      { menu_id: menuIds[1], prefs: 'Sushi fan', restrictions: 'None', items: JSON.stringify([{item_name: 'Salmon Sashimi', rank: 1}, {item_name: 'Dragon Roll', rank: 2}]), reasoning: 'Premium sushi selection', meal: 'Dinner', budget: 'Premium' },
      { menu_id: menuIds[1], prefs: 'First time trying Japanese', restrictions: 'None', items: JSON.stringify([{item_name: 'California Roll', rank: 1}, {item_name: 'Chicken Teriyaki', rank: 2}]), reasoning: 'Beginner-friendly choices', meal: 'Lunch', budget: 'Moderate' },
      { menu_id: menuIds[1], prefs: 'Vegan', restrictions: 'Vegan', items: JSON.stringify([{item_name: 'Edamame', rank: 1}, {item_name: 'Seaweed Salad', rank: 2}]), reasoning: 'Vegan Japanese options', meal: 'Lunch', budget: 'Budget-friendly' },
      { menu_id: menuIds[1], prefs: 'Love noodles', restrictions: 'None', items: JSON.stringify([{item_name: 'Beef Ramen', rank: 1}, {item_name: 'Udon Noodle Soup', rank: 2}]), reasoning: 'Best noodle dishes', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[2], prefs: 'Love spicy food', restrictions: 'None', items: JSON.stringify([{item_name: 'Vindaloo', rank: 1}, {item_name: 'Green Curry', rank: 2}]), reasoning: 'Spiciest dishes on menu', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[2], prefs: 'Mild flavors preferred', restrictions: 'None', items: JSON.stringify([{item_name: 'Butter Chicken', rank: 1}, {item_name: 'Chicken Korma', rank: 2}]), reasoning: 'Mild and creamy options', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[2], prefs: 'Vegetarian', restrictions: 'Vegetarian', items: JSON.stringify([{item_name: 'Palak Paneer', rank: 1}, {item_name: 'Dal Makhani', rank: 2}]), reasoning: 'Popular vegetarian curries', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[2], prefs: 'Thai food lover', restrictions: 'None', items: JSON.stringify([{item_name: 'Pad Thai', rank: 1}, {item_name: 'Green Curry', rank: 2}]), reasoning: 'Authentic Thai selections', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[0], prefs: 'Comfort food', restrictions: 'None', items: JSON.stringify([{item_name: 'Lasagna Bolognese', rank: 1}, {item_name: 'Chicken Parmigiana', rank: 2}]), reasoning: 'Hearty comfort dishes', meal: 'Dinner', budget: 'Moderate' },
      { menu_id: menuIds[1], prefs: 'Light meal', restrictions: 'None', items: JSON.stringify([{item_name: 'Miso Soup', rank: 1}, {item_name: 'Edamame', rank: 2}]), reasoning: 'Light and healthy options', meal: 'Lunch', budget: 'Budget-friendly' },
      { menu_id: menuIds[2], prefs: 'Rice dishes', restrictions: 'None', items: JSON.stringify([{item_name: 'Lamb Biryani', rank: 1}]), reasoning: 'Signature rice dish', meal: 'Dinner', budget: 'Premium' },
      { menu_id: menuIds[0], prefs: 'Sweet tooth', restrictions: 'Vegetarian', items: JSON.stringify([{item_name: 'Tiramisu', rank: 1}, {item_name: 'Panna Cotta', rank: 2}, {item_name: 'Cannoli', rank: 3}]), reasoning: 'Italian dessert selection', meal: 'Any', budget: 'Moderate' }
    ];

    for (const rec of recommendations) {
      await pool.query(
        `INSERT INTO dish_recommendations (menu_id, customer_preferences, dietary_restrictions, recommended_items, reasoning, meal_type, budget_range)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [rec.menu_id, rec.prefs, rec.restrictions, rec.items, rec.reasoning, rec.meal, rec.budget]
      );
    }

    // Add AI analysis history entries (15 entries)
    const aiAnalysisEntries = [
      { menu_id: menuIds[0], type: 'text_parsing', input: 'Parsed full Italian menu text with 17 items', model: 'gpt-4', tokens: 2450 },
      { menu_id: menuIds[1], type: 'text_parsing', input: 'Parsed Japanese restaurant menu with sushi items', model: 'gpt-4', tokens: 1890 },
      { menu_id: menuIds[2], type: 'text_parsing', input: 'Parsed Indian/Asian fusion menu', model: 'gpt-4', tokens: 2100 },
      { menu_id: menuIds[0], type: 'allergen_detection', input: 'Detected allergens for Spaghetti Carbonara', model: 'gpt-4', tokens: 820 },
      { menu_id: menuIds[0], type: 'allergen_detection', input: 'Detected allergens for Tiramisu', model: 'gpt-4', tokens: 750 },
      { menu_id: menuIds[1], type: 'allergen_detection', input: 'Detected allergens for Dragon Roll', model: 'gpt-4', tokens: 680 },
      { menu_id: menuIds[0], type: 'calorie_estimation', input: 'Estimated calories for Margherita Pizza', model: 'gpt-4', tokens: 920 },
      { menu_id: menuIds[1], type: 'calorie_estimation', input: 'Estimated calories for Beef Ramen', model: 'gpt-4', tokens: 880 },
      { menu_id: menuIds[2], type: 'calorie_estimation', input: 'Estimated calories for Butter Chicken', model: 'gpt-4', tokens: 910 },
      { menu_id: menuIds[0], type: 'translation', input: 'Translated Margherita Pizza to Spanish', model: 'gpt-4', tokens: 540 },
      { menu_id: menuIds[0], type: 'translation', input: 'Translated Spaghetti Carbonara to French', model: 'gpt-4', tokens: 580 },
      { menu_id: menuIds[2], type: 'translation', input: 'Translated Butter Chicken to Hindi', model: 'gpt-4', tokens: 620 },
      { menu_id: menuIds[1], type: 'menu_digitization', input: 'Digitized Tokyo Garden menu from uploaded image', model: 'gpt-4-vision', tokens: 3200 },
      { menu_id: menuIds[0], type: 'menu_digitization', input: 'Digitized Bella Italia menu from text input', model: 'gpt-4', tokens: 2800 },
      { menu_id: menuIds[2], type: 'menu_digitization', input: 'Digitized Spice Route menu from text input', model: 'gpt-4', tokens: 2650 },
    ];

    for (const entry of aiAnalysisEntries) {
      await pool.query(
        `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entry.menu_id, entry.type, entry.input, JSON.stringify({ summary: entry.input, status: 'completed' }), entry.model, entry.tokens]
      );
    }

    console.log('Database seeded successfully!');
    console.log(`   - 16 users created (1 demo + 15 additional)`);
    console.log(`   - Demo user: demo@menudigitizer.com / demo123456 (admin, verified)`);
    console.log(`   - ${menus.length} menus created`);
    console.log(`   - ${menuItems.length} menu items created`);
    console.log(`   - ${allergens.length} allergen entries created`);
    console.log(`   - ${nutritionData.length} nutrition entries created`);
    console.log(`   - ${translations.length} translation entries created`);
    console.log(`   - ${priceSuggestions.length} price suggestion entries created`);
    console.log(`   - ${recommendations.length} dish recommendation entries created`);
    console.log(`   - ${aiAnalysisEntries.length} AI analysis history entries created`);
    console.log(`   - 15 token_blacklist entries created (expired)`);

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

export default seed;

// Run if executed directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
