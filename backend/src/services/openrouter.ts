import pool from '../db/connection';

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIAnalysisResult {
  success: boolean;
  data: any;
  rawResponse?: string;
  tokensUsed?: number;
  error?: string;
}

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class OpenRouterService {
  private apiKey: string;
  private model: string;
  private visionModel: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
    // Vision model must support image_url content blocks
    this.visionModel = process.env.OPENROUTER_VISION_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
  }

  private async makeRequest(messages: { role: string; content: any }[], modelOverride?: string): Promise<OpenRouterResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'AI Menu Digitizer'
          },
          body: JSON.stringify({
            model: modelOverride || this.model,
            messages,
            temperature: 0.3,
            max_tokens: 10000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          // Only retry on 5xx errors
          if (response.status >= 500 && attempt < RETRY_ATTEMPTS) {
            lastError = new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            await sleep(RETRY_DELAY_MS * attempt);
            continue;
          }
          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        return response.json() as Promise<OpenRouterResponse>;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          lastError = new Error('Request timed out after 30 seconds');
        } else {
          lastError = err;
        }
        if (attempt < RETRY_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private parseJsonResponse(content: string, requiredFields?: string[]): any {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error('Could not parse JSON from response');
        }
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }

    // Validate required fields if provided
    if (requiredFields && requiredFields.length > 0) {
      const missing = requiredFields.filter(f => !(f in parsed));
      if (missing.length > 0) {
        throw new Error(`AI response missing required fields: ${missing.join(', ')}`);
      }
    }

    return parsed;
  }

  async analyzeMenuImage(imageBase64: string, menuId?: number, mimeType: string = 'image/jpeg'): Promise<AIAnalysisResult> {
    try {
      // Strip any data URL prefix the client may have included — use the full base64 payload
      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');

      // Send a proper vision message with Anthropic-style content blocks
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/jpeg',
                data: base64Data
              }
            },
            {
              type: 'text',
              text: 'Extract all menu items from this image. Return JSON: { menu_name, items: [{name, description, price, category, dietary_flags: {vegetarian, vegan, gluten_free}}] }'
            }
          ]
        }
      ];

      const response = await this.makeRequest(messages, this.visionModel);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content, ['items']);

      // Log to database
      if (menuId) {
        await pool.query(
          `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [menuId, 'menu_digitization', 'image', data, this.visionModel, response.usage?.total_tokens || 0]
        );
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  async detectAllergens(itemName: string, description: string, menuItemId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a food allergen detection expert. Analyze the food item and identify potential allergens.
Return a JSON object with the following structure:
{
  "item_name": "string",
  "allergens": [
    {
      "name": "string (e.g., Gluten, Dairy, Eggs, Peanuts, Tree Nuts, Soy, Fish, Shellfish, Sesame)",
      "severity": "high" | "moderate" | "low",
      "description": "string explaining why this allergen is present",
      "confidence": number (0-100),
      "icon": "string emoji representing the allergen"
    }
  ],
  "dietary_info": {
    "is_vegetarian": boolean,
    "is_vegan": boolean,
    "is_gluten_free": boolean,
    "is_halal": boolean,
    "is_kosher": boolean
  },
  "warnings": ["string array of additional warnings"],
  "safe_alternatives": ["string array of safer alternatives for those with allergies"],
  "cross_contamination_risk": "high" | "moderate" | "low" | "none",
  "summary": "A brief summary paragraph about the allergen analysis"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Analyze this food item for allergens:\nName: ${itemName}\nDescription: ${description}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      if (menuItemId) {
        const menuResult = await pool.query(
          'SELECT menu_id FROM menu_items WHERE id = $1',
          [menuItemId]
        );
        if (menuResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [menuResult.rows[0].menu_id, 'allergen_detection', `${itemName}: ${description}`, data, this.model, response.usage?.total_tokens || 0]
          );
        }
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  async estimateCalories(itemName: string, description: string, menuItemId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a nutritionist expert. Estimate the nutritional information for the food item.
Return a JSON object with the following structure:
{
  "item_name": "string",
  "nutrition": {
    "calories": number,
    "protein": number (grams),
    "carbohydrates": number (grams),
    "fat": number (grams),
    "saturated_fat": number (grams),
    "fiber": number (grams),
    "sodium": number (mg),
    "sugar": number (grams),
    "cholesterol": number (mg)
  },
  "serving_size": "string (e.g., '1 plate (350g)')",
  "servings_per_portion": number,
  "confidence": number (0-100),
  "notes": "string with any relevant notes about the estimation",
  "health_rating": {
    "score": number (1-10),
    "label": "Excellent" | "Good" | "Moderate" | "Poor",
    "description": "string explaining the rating"
  },
  "daily_value_percentages": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiber": number,
    "sodium": number
  },
  "dietary_tags": ["string array like 'High Protein', 'Low Carb', etc."],
  "recommendations": "string with health recommendations"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Estimate the nutritional information for this food item:\nName: ${itemName}\nDescription: ${description}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      if (menuItemId) {
        const menuResult = await pool.query(
          'SELECT menu_id FROM menu_items WHERE id = $1',
          [menuItemId]
        );
        if (menuResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [menuResult.rows[0].menu_id, 'calorie_estimation', `${itemName}: ${description}`, data, this.model, response.usage?.total_tokens || 0]
          );
        }
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  async translateMenuItem(itemName: string, description: string, targetLanguage: string, menuItemId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a professional food menu translator. Translate the menu item to the target language.
Maintain culinary terminology and cultural appropriateness.
Return a JSON object with the following structure:
{
  "original": {
    "name": "string",
    "description": "string"
  },
  "translation": {
    "language_code": "string (e.g., 'es', 'fr', 'de', 'zh', 'ja')",
    "language_name": "string (e.g., 'Spanish', 'French')",
    "translated_name": "string",
    "translated_description": "string",
    "native_script": "string (if applicable, e.g., Chinese characters)"
  },
  "pronunciation_guide": "string phonetic guide or null",
  "cultural_notes": "string or null explaining cultural context",
  "confidence": number (0-100),
  "alternative_names": ["string array of alternative translations"],
  "common_ingredients_translated": [
    {
      "english": "string",
      "translated": "string"
    }
  ]
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Translate this menu item to ${targetLanguage}:\nName: ${itemName}\nDescription: ${description}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      if (menuItemId) {
        const menuResult = await pool.query(
          'SELECT menu_id FROM menu_items WHERE id = $1',
          [menuItemId]
        );
        if (menuResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [menuResult.rows[0].menu_id, 'translation', `${itemName} -> ${targetLanguage}`, data, this.model, response.usage?.total_tokens || 0]
          );
        }
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  async analyzeMenuText(menuText: string, menuId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a menu analysis expert. Parse the provided menu text and extract structured data.
Return a JSON object with the following structure:
{
  "restaurant_name": "string or null",
  "items": [
    {
      "name": "string",
      "description": "string",
      "price": number or null,
      "category": "string (e.g., Appetizer, Main Course, Dessert, Beverage)",
      "is_vegetarian": boolean,
      "is_vegan": boolean,
      "is_gluten_free": boolean,
      "spice_level": 0-4
    }
  ],
  "categories_found": ["string array"],
  "currency": "string or null"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Parse this menu text and extract all items:\n\n${menuText}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      if (menuId) {
        await pool.query(
          `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [menuId, 'text_parsing', menuText.substring(0, 500), data, this.model, response.usage?.total_tokens || 0]
        );
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // AI Price Optimizer
  async optimizePrice(itemName: string, description: string, currentPrice: number, category: string, menuItemId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a restaurant pricing strategy expert. Analyze the menu item and provide optimal pricing suggestions.
Consider market trends, ingredient costs, perceived value, competition, and profit margins.
Return a JSON object with the following structure:
{
  "item_name": "string",
  "current_price": number,
  "pricing_analysis": {
    "suggested_price": number,
    "min_price": number,
    "max_price": number,
    "optimal_range": {
      "low": number,
      "high": number
    }
  },
  "confidence": number (0-100),
  "market_analysis": {
    "demand_level": "High" | "Medium" | "Low",
    "competition_level": "High" | "Medium" | "Low",
    "price_sensitivity": "High" | "Medium" | "Low",
    "seasonal_factor": "Peak" | "Normal" | "Off-peak"
  },
  "profit_analysis": {
    "estimated_cost": number,
    "estimated_margin_percent": number,
    "margin_rating": "Excellent" | "Good" | "Acceptable" | "Low"
  },
  "recommendations": [
    {
      "type": "string (e.g., 'Price Increase', 'Bundle Deal', 'Happy Hour')",
      "description": "string",
      "potential_impact": "string"
    }
  ],
  "competitive_positioning": "Premium" | "Mid-range" | "Value" | "Budget",
  "psychological_pricing": {
    "suggested": number,
    "explanation": "string (e.g., '$14.99 instead of $15 for perceived value')"
  },
  "reasoning": "A detailed paragraph explaining the pricing recommendation"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Analyze and optimize pricing for this menu item:
Name: ${itemName}
Description: ${description}
Current Price: $${currentPrice}
Category: ${category}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      if (menuItemId) {
        const menuResult = await pool.query(
          'SELECT menu_id FROM menu_items WHERE id = $1',
          [menuItemId]
        );
        if (menuResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [menuResult.rows[0].menu_id, 'price_optimization', `${itemName}: $${currentPrice}`, data, this.model, response.usage?.total_tokens || 0]
          );

          // Store in price_suggestions table
          await pool.query(
            `INSERT INTO price_suggestions (menu_item_id, current_price, suggested_price, min_price, max_price, confidence, reasoning, market_analysis, profit_margin, demand_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (menu_item_id) DO UPDATE SET
               current_price = EXCLUDED.current_price,
               suggested_price = EXCLUDED.suggested_price,
               min_price = EXCLUDED.min_price,
               max_price = EXCLUDED.max_price,
               confidence = EXCLUDED.confidence,
               reasoning = EXCLUDED.reasoning,
               market_analysis = EXCLUDED.market_analysis,
               profit_margin = EXCLUDED.profit_margin,
               demand_level = EXCLUDED.demand_level,
               updated_at = CURRENT_TIMESTAMP`,
            [
              menuItemId,
              currentPrice,
              data.pricing_analysis?.suggested_price || currentPrice,
              data.pricing_analysis?.min_price || currentPrice * 0.8,
              data.pricing_analysis?.max_price || currentPrice * 1.2,
              data.confidence || 80,
              data.reasoning || '',
              JSON.stringify(data.market_analysis || {}),
              data.profit_analysis?.estimated_margin_percent || 0,
              data.market_analysis?.demand_level || 'Medium'
            ]
          );
        }
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // AI Dish Recommender
  async recommendDishes(menuId: number, preferences: string, dietaryRestrictions: string, mealType: string, budget: string): Promise<AIAnalysisResult> {
    try {
      // Get menu items for context
      const menuResult = await pool.query(
        `SELECT mi.*, m.restaurant_name
         FROM menu_items mi
         JOIN menus m ON mi.menu_id = m.id
         WHERE mi.menu_id = $1`,
        [menuId]
      );

      const menuItems = menuResult.rows;
      const itemsList = menuItems.map(item =>
        `- ${item.name} ($${item.price}): ${item.description} [${item.category}]${item.is_vegetarian ? ' (Vegetarian)' : ''}${item.is_vegan ? ' (Vegan)' : ''}${item.is_gluten_free ? ' (Gluten-Free)' : ''}`
      ).join('\n');

      const messages = [
        {
          role: 'system',
          content: `You are an expert restaurant sommelier and food recommender. Based on the customer's preferences and the available menu items, provide personalized dish recommendations.
Return a JSON object with the following structure:
{
  "customer_profile": {
    "preferences": "string summary",
    "dietary_restrictions": ["string array"],
    "meal_type": "string",
    "budget": "string"
  },
  "recommendations": [
    {
      "rank": number (1-5),
      "item_name": "string (must match exactly from menu)",
      "category": "string",
      "price": number,
      "match_score": number (0-100),
      "why_recommended": "string explaining why this dish is perfect for them",
      "flavor_profile": ["string array like 'Savory', 'Umami', etc."],
      "best_paired_with": ["string array of complementary dishes from menu"],
      "avoid_if": "string or null (any reasons to avoid)"
    }
  ],
  "meal_suggestion": {
    "appetizer": "string item name or null",
    "main_course": "string item name",
    "side": "string item name or null",
    "dessert": "string item name or null",
    "beverage": "string item name or null",
    "total_estimated_price": number
  },
  "special_notes": "string with any special dining tips or notes",
  "alternatives_for_restrictions": [
    {
      "original_item": "string",
      "restriction": "string",
      "alternative": "string"
    }
  ],
  "summary": "A friendly paragraph summarizing the recommendations"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Based on these customer preferences, recommend dishes from the menu:

Customer Preferences: ${preferences || 'No specific preferences'}
Dietary Restrictions: ${dietaryRestrictions || 'None'}
Meal Type: ${mealType || 'Any'}
Budget: ${budget || 'Any'}

Available Menu Items:
${itemsList}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      await pool.query(
        `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [menuId, 'dish_recommendation', `Preferences: ${preferences}, Restrictions: ${dietaryRestrictions}`, data, this.model, response.usage?.total_tokens || 0]
      );

      // Store recommendation
      await pool.query(
        `INSERT INTO dish_recommendations (menu_id, customer_preferences, dietary_restrictions, recommended_items, reasoning, meal_type, budget_range)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          menuId,
          preferences || '',
          dietaryRestrictions || '',
          JSON.stringify(data.recommendations || []),
          data.summary || '',
          mealType || 'Any',
          budget || 'Any'
        ]
      );

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // Analyze nutrition for healthcare purposes
  async analyzeNutritionHealthcare(itemName: string, description: string, healthConditions: string, menuItemId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a clinical nutritionist and healthcare diet specialist. Analyze the food item for health considerations.
Return a JSON object with the following structure:
{
  "item_name": "string",
  "nutrition_summary": {
    "calories": number,
    "protein": number,
    "carbohydrates": number,
    "fat": number,
    "fiber": number,
    "sodium": number,
    "sugar": number
  },
  "health_assessment": {
    "overall_score": number (1-10),
    "label": "Highly Recommended" | "Recommended" | "Moderate" | "Caution" | "Not Recommended",
    "summary": "string"
  },
  "condition_specific": [
    {
      "condition": "string (e.g., 'Diabetes', 'Heart Disease', etc.)",
      "suitability": "Safe" | "Caution" | "Avoid",
      "explanation": "string",
      "modifications": "string suggestions to make it safer"
    }
  ],
  "glycemic_info": {
    "estimated_gi": "Low" | "Medium" | "High",
    "glycemic_load": number,
    "blood_sugar_impact": "string"
  },
  "heart_health": {
    "cholesterol_content": "Low" | "Medium" | "High",
    "sodium_level": "Low" | "Medium" | "High",
    "saturated_fat": "Low" | "Medium" | "High",
    "recommendation": "string"
  },
  "vitamins_minerals": [
    {
      "nutrient": "string",
      "amount": "string",
      "daily_value_percent": number,
      "benefit": "string"
    }
  ],
  "warnings": ["string array of health warnings"],
  "benefits": ["string array of health benefits"],
  "portion_guidance": {
    "recommended_portion": "string",
    "frequency": "string (e.g., 'Daily', '2-3 times per week')"
  },
  "healthier_alternatives": ["string array"],
  "detailed_analysis": "A comprehensive paragraph about the health implications"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Analyze this food item for health and nutrition (healthcare context):
Name: ${itemName}
Description: ${description}
${healthConditions ? `Patient's Health Conditions: ${healthConditions}` : ''}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      // Log to database
      if (menuItemId) {
        const menuResult = await pool.query(
          'SELECT menu_id FROM menu_items WHERE id = $1',
          [menuItemId]
        );
        if (menuResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [menuResult.rows[0].menu_id, 'nutrition_healthcare', `${itemName}: ${healthConditions || 'general'}`, data, this.model, response.usage?.total_tokens || 0]
          );
        }
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // PDF Menu Analysis — analyzes extracted text from a PDF
  async analyzeMenuPdf(pdfText: string, menuId?: number): Promise<AIAnalysisResult> {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a menu analysis expert. Parse the provided menu text extracted from a PDF and extract structured data.
Return a JSON object with the following structure:
{
  "restaurant_name": "string or null",
  "items": [
    {
      "name": "string",
      "description": "string",
      "price": number or null,
      "category": "string (e.g., Appetizer, Main Course, Dessert, Beverage)",
      "is_vegetarian": boolean,
      "is_vegan": boolean,
      "is_gluten_free": boolean,
      "spice_level": 0-4
    }
  ],
  "categories_found": ["string array"],
  "currency": "string or null"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Parse this PDF menu text and extract all items:\n\n${pdfText}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content, ['items']);

      if (menuId) {
        await pool.query(
          `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [menuId, 'pdf_parsing', pdfText.substring(0, 500), data, this.model, response.usage?.total_tokens || 0]
        );
      }

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // Menu Engineering Score — classify items as Star/Plowhorse/Puzzle/Dog
  async menuEngineerScore(menuId: number): Promise<AIAnalysisResult> {
    try {
      const itemsResult = await pool.query(
        `SELECT id, name, description, price, category FROM menu_items WHERE menu_id = $1`,
        [menuId]
      );

      if (itemsResult.rows.length === 0) {
        return { success: false, data: null, error: 'No menu items found for this menu' };
      }

      const itemsList = itemsResult.rows.map(item =>
        `{ id: ${item.id}, name: "${item.name}", category: "${item.category || 'General'}", price: ${item.price || 0} }`
      ).join('\n');

      const messages = [
        {
          role: 'system',
          content: `You are a restaurant menu engineering expert. Analyze menu items for profitability and popularity potential.
Classify each item as Star/Plowhorse/Puzzle/Dog based on menu engineering principles.
Return JSON:
{
  "items": [
    {
      "id": number,
      "name": "string",
      "classification": "Star" | "Plowhorse" | "Puzzle" | "Dog",
      "reasoning": "string",
      "recommended_action": "string"
    }
  ],
  "overall_menu_health": "string",
  "top_recommendations": ["string"]
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Analyze these menu items for profitability and popularity potential:\n${itemsList}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content, ['items', 'overall_menu_health', 'top_recommendations']);

      // Optionally store results in price_suggestions table
      if (data.items && Array.isArray(data.items)) {
        for (const scored of data.items) {
          try {
            const originalItem = itemsResult.rows.find((r: any) => r.id === scored.id);
            if (originalItem) {
              await pool.query(
                `INSERT INTO price_suggestions (menu_item_id, current_price, suggested_price, min_price, max_price, confidence, reasoning, market_analysis, profit_margin, demand_level)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (menu_item_id) DO UPDATE SET
                   reasoning = EXCLUDED.reasoning,
                   market_analysis = EXCLUDED.market_analysis,
                   updated_at = CURRENT_TIMESTAMP`,
                [
                  scored.id,
                  originalItem.price || 0,
                  originalItem.price || 0,
                  originalItem.price || 0,
                  originalItem.price || 0,
                  80,
                  `[${scored.classification}] ${scored.reasoning}`,
                  JSON.stringify({ classification: scored.classification, recommended_action: scored.recommended_action }),
                  0,
                  scored.classification === 'Star' || scored.classification === 'Plowhorse' ? 'High' : 'Low'
                ]
              );
            }
          } catch {
            // Non-fatal: continue even if storing individual item fails
          }
        }
      }

      await pool.query(
        `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [menuId, 'menu_engineering', `${itemsResult.rows.length} items`, data, this.model, response.usage?.total_tokens || 0]
      );

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  // Dietary filter recommendations — surface items matching strict diet filters,
  // and suggest substitutions / new dish ideas where coverage is thin.
  async dietaryFilterRecommendations(menuId: number, filters: string[], notes: string = ''): Promise<AIAnalysisResult> {
    try {
      const itemsResult = await pool.query(
        `SELECT id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free
         FROM menu_items WHERE menu_id = $1`,
        [menuId]
      );

      if (itemsResult.rows.length === 0) {
        return { success: false, data: null, error: 'No menu items found for this menu' };
      }

      const itemsList = itemsResult.rows.map(item =>
        `- id=${item.id} | ${item.name} ($${item.price}) [${item.category || 'General'}] vegetarian=${!!item.is_vegetarian} vegan=${!!item.is_vegan} gluten_free=${!!item.is_gluten_free} :: ${item.description || ''}`
      ).join('\n');

      const filterList = (filters && filters.length ? filters : ['vegan', 'gluten_free', 'vegetarian']).join(', ');

      const messages = [
        {
          role: 'system',
          content: `You are a dietary-aware restaurant consultant. Given menu items and a list of dietary filters, classify what's already compliant, what could be made compliant with substitutions, and where the menu has gaps.
Return JSON:
{
  "filters": ["string"],
  "compliant_items": [{ "id": number, "name": "string", "filter": "string", "confidence": "low|medium|high" }],
  "convertible_items": [{ "id": number, "name": "string", "filter": "string", "substitution": "string", "rationale": "string" }],
  "coverage_gaps": [{ "filter": "string", "gap_description": "string", "suggested_new_dishes": ["string"] }],
  "summary": "string"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Filters: ${filterList}\nNotes: ${notes || '(none)'}\n\nMenu items:\n${itemsList}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      await pool.query(
        `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [menuId, 'dietary_filter_recommendations', `Filters: ${filterList}`, data, this.model, response.usage?.total_tokens || 0]
      );

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  }

  // Seasonal rotation — propose a refresh of the menu for a specific season
  // (or month), keeping cost/operational constraints in mind.
  async menuSeasonalRotation(menuId: number, season: string, region: string = ''): Promise<AIAnalysisResult> {
    try {
      const itemsResult = await pool.query(
        `SELECT id, name, description, price, category FROM menu_items WHERE menu_id = $1`,
        [menuId]
      );

      if (itemsResult.rows.length === 0) {
        return { success: false, data: null, error: 'No menu items found for this menu' };
      }

      const itemsList = itemsResult.rows.map(item =>
        `- id=${item.id} | ${item.name} ($${item.price}) [${item.category || 'General'}] :: ${item.description || ''}`
      ).join('\n');

      const messages = [
        {
          role: 'system',
          content: `You are a seasonal menu strategist. Given a current menu, propose a seasonal rotation for the requested season: which items to keep, which to retire, which to add. Consider regional ingredient availability and customer expectations.
Return JSON:
{
  "season": "string",
  "region": "string",
  "keep": [{ "id": number, "name": "string", "reason": "string" }],
  "retire": [{ "id": number, "name": "string", "reason": "string" }],
  "add": [{ "name": "string", "category": "string", "key_ingredients": ["string"], "estimated_price": number, "rationale": "string" }],
  "menu_balance_notes": "string",
  "summary": "string"
}
Only respond with valid JSON, no additional text.`
        },
        {
          role: 'user',
          content: `Season: ${season}\nRegion: ${region || '(unspecified)'}\n\nCurrent menu:\n${itemsList}`
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content || '';
      const data = this.parseJsonResponse(content);

      await pool.query(
        `INSERT INTO ai_analysis (menu_id, analysis_type, input_data, output_data, model_used, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [menuId, 'seasonal_rotation', `Season: ${season}, Region: ${region}`, data, this.model, response.usage?.total_tokens || 0]
      );

      return {
        success: true,
        data,
        rawResponse: content,
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error: any) {
      return { success: false, data: null, error: error.message };
    }
  }
}

export default new OpenRouterService();
