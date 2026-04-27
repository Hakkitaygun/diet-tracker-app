const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');
const { getAIFoodSuggestion } = require('../geminiService');
const { analyzeFoodImage } = require('../visionService');

const normalizeForSearch = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/ı/g, 'i')
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ş/g, 's')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c');

const shouldUseAiForSearch = (query) => normalizeForSearch(query).length >= 3;

const BRAND_FOOD_OVERRIDES = [
  {
    keys: ['nutella', 'findik kremasi', 'fındık kreması'],
    food: {
      name: 'Nutella',
      category: 'Tatlılar',
      description: 'Kakaolu fındık kreması',
      calories_per_100g: 539,
      protein_per_100g: 6.3,
      carbs_per_100g: 57.5,
      fat_per_100g: 30.9,
      confidence: 'high'
    }
  },
  {
    keys: ['coco pops', 'cocopops', 'kelloggs coco pops', 'kellogg coco pops'],
    food: {
      name: 'Coco Pops',
      category: 'Tahıllar',
      description: 'Kakaolu kahvaltilik gevrek',
      calories_per_100g: 385,
      protein_per_100g: 7,
      carbs_per_100g: 84,
      fat_per_100g: 2.5,
      confidence: 'high'
    }
  }
];

const getBrandOverride = (query) => {
  const folded = normalizeForSearch(query);
  return BRAND_FOOD_OVERRIDES.find((entry) =>
    entry.keys.some((key) => folded.includes(normalizeForSearch(key)))
  )?.food || null;
};

const isSuspiciousGeneratedFood = (food) => {
  const name = String(food?.name || '').trim();
  const category = String(food?.category || '').trim().toLowerCase();
  const description = String(food?.description || '').trim().toLowerCase();
  const isDefaultAiRecord = category === 'ai üretilen'.toLowerCase() || description.includes('ai tarafından oluşturuldu');
  return isDefaultAiRecord && name.length <= 5 && !name.includes(' ');
};

const localTurkishFilter = (foods, query, limit) => {
  const foldedQuery = normalizeForSearch(query);
  if (!foldedQuery) return [];

  const matches = foods.filter((food) => {
    const haystack = [food.name, food.category, food.description]
      .map((part) => normalizeForSearch(part))
      .join(' ');
    return haystack.includes(foldedQuery);
  });

  return matches.slice(0, limit);
};

const sanitizeAiFood = (food) => {
  const name = String(food?.name || '').replace(/\s+/g, ' ').trim();
  const category = String(food?.category || 'AI Üretilen').replace(/\s+/g, ' ').trim();
  const description = String(food?.description || 'AI tarafından oluşturuldu').replace(/\s+/g, ' ').trim();

  return {
    name,
    category,
    description,
    calories_per_100g: Math.max(1, Math.min(900, Math.round(Number(food?.calories_per_100g) || 0))),
    protein_per_100g: Math.max(0, Math.min(100, Number(food?.protein_per_100g) || 0)),
    carbs_per_100g: Math.max(0, Math.min(100, Number(food?.carbs_per_100g) || 0)),
    fat_per_100g: Math.max(0, Math.min(100, Number(food?.fat_per_100g) || 0)),
    confidence: String(food?.confidence || 'low').toLowerCase()
  };
};

const isValidAiFood = (food) => {
  if (!food?.name || food.name.length < 2 || food.name.length > 64) return false;
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(food.name)) return false;
  if (!Number.isFinite(food.calories_per_100g) || food.calories_per_100g <= 0) return false;
  return true;
};

const calcPortionNutrition = (food, grams) => {
  const multiplier = grams / 100;
  return {
    calories: Math.round((food.calories_per_100g || 0) * multiplier),
    protein: parseFloat(((food.protein_per_100g || 0) * multiplier).toFixed(1)),
    carbs: parseFloat(((food.carbs_per_100g || 0) * multiplier).toFixed(1)),
    fat: parseFloat(((food.fat_per_100g || 0) * multiplier).toFixed(1))
  };
};

const upsertFoodRecord = async (food) => {
  const name = String(food.name || '').trim();
  if (!name) return null;

  const existing = await get('SELECT * FROM food_database WHERE name = ?', [name]);
  if (existing) {
    return existing;
  }

  await run(
    `INSERT INTO food_database (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      Math.round(Number(food.calories_per_100g) || 0),
      Number(food.protein_per_100g) || 0,
      Number(food.carbs_per_100g) || 0,
      Number(food.fat_per_100g) || 0,
      String(food.category || 'AI Üretilen').trim(),
      String(food.description || 'AI tarafından oluşturuldu').trim()
    ]
  );

  return get('SELECT * FROM food_database WHERE name = ?', [name]);
};

// Get all foods with optional search
router.get('/', async (req, res) => {
  try {
    const { search, category, limit = 200 } = req.query;
    const searchText = String(search || '').trim();
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 200, 500));
    let query = 'SELECT * FROM food_database';
    let params = [];

    if (searchText) {
      query += ' WHERE name LIKE ? OR category LIKE ? OR description LIKE ?';
      params.push(`%${searchText}%`, `%${searchText}%`, `%${searchText}%`);
    }
    if (category) {
      query += searchText ? ' AND category = ?' : ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name LIMIT ?';
    params.push(safeLimit);

    let foods = await all(query, params);
    foods = foods.filter((food) => !isSuspiciousGeneratedFood(food));

    // Fallback to accent-insensitive local filtering if SQL LIKE misses Turkish variants.
    if (searchText && foods.length === 0) {
      const allFoods = await all('SELECT * FROM food_database ORDER BY category, name');
      foods = localTurkishFilter(allFoods, searchText, safeLimit).filter((food) => !isSuspiciousGeneratedFood(food));
    }

    if (searchText && foods.length === 0) {
      const brandFood = getBrandOverride(searchText);
      if (brandFood) {
        foods = [{ ...brandFood, ai_generated: true, confidence: 'high', transient: true }];
      }
    }

    if (searchText && foods.length === 0 && shouldUseAiForSearch(searchText)) {
      const aiResult = await getAIFoodSuggestion(searchText);
      if (aiResult?.success && aiResult.food) {
        const candidate = sanitizeAiFood(aiResult.food);
        const confidence = candidate.confidence;

        if (isValidAiFood(candidate)) {
          // Return AI suggestion as transient result; do not persist to catalog.
          foods = [{ ...candidate, ai_generated: true, confidence, transient: true }];
        }
      }
    }

    res.json(foods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get food categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await all('SELECT DISTINCT category FROM food_database ORDER BY category');
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/analyze-image', async (req, res) => {
  try {
    const { image_base64, mime_type, hint_text } = req.body;

    if (!image_base64 || !mime_type) {
      return res.status(400).json({ error: 'image_base64 and mime_type are required' });
    }

    const result = await analyzeFoodImage(image_base64, mime_type, hint_text || '');

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Image analysis failed' });
    }

    res.json(result.estimate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate catalog-based meal plans that are not tied to previously logged foods
router.get('/meal-plans', async (req, res) => {
  try {
    const remainingCalories = Math.max(0, parseInt(req.query.remainingCalories, 10) || 600);
    const goal = String(req.query.goal || 'balance').toLowerCase();

    const foods = await all('SELECT * FROM food_database');
    const byName = foods.reduce((acc, food) => {
      acc[food.name] = food;
      return acc;
    }, {});

    const buildItem = (name, grams) => {
      const food = byName[name];
      if (!food) return null;
      return {
        name: food.name,
        grams,
        ...calcPortionNutrition(food, grams)
      };
    };

    const buildPlan = (title, description, itemSpecs) => {
      const items = itemSpecs.map(([name, grams]) => buildItem(name, grams)).filter(Boolean);
      const totals = items.reduce((acc, item) => ({
        calories: acc.calories + item.calories,
        protein: parseFloat((acc.protein + item.protein).toFixed(1)),
        carbs: parseFloat((acc.carbs + item.carbs).toFixed(1)),
        fat: parseFloat((acc.fat + item.fat).toFixed(1))
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      return {
        title,
        description,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFat: totals.fat,
        items
      };
    };

    const lightMode = remainingCalories < 450 || goal === 'weight_loss';

    const plans = lightMode ? [
      buildPlan('Hafif Protein Tabagi', 'Kilo verme ve günün kalanını dengede tutma odaklı', [
        ['Yumurta', 100],
        ['Yoğurt', 150],
        ['Salata', 120],
        ['Tam buğday ekmeği', 50]
      ]),
      buildPlan('Akıllı Öğle', 'Tok tutan ama ağır olmayan öğün', [
        ['Tavuk göğsü', 120],
        ['Bulgur', 120],
        ['Domates', 100],
        ['Salatalık', 100]
      ]),
      buildPlan('Geceye Uygun Ara Öğün', 'Hafif ve yüksek proteinli', [
        ['Kefir', 250],
        ['Lor peyniri', 80],
        ['Çilek', 100]
      ])
    ] : [
      buildPlan('Yüksek Protein Ana Tabak', 'Kas koruma ve toparlanma için', [
        ['Tavuk göğsü', 180],
        ['Bulgur', 160],
        ['Yoğurt', 150],
        ['Salata', 120]
      ]),
      buildPlan('Klasik Dengeli Öğün', 'Karbonhidrat, protein ve lif dengesi', [
        ['Hindi göğsü', 150],
        ['Tam buğday makarna', 180],
        ['Ispanak', 120],
        ['Domates', 100]
      ]),
      buildPlan('Antrenman Sonrası Tabak', 'Daha yüksek enerji ihtiyacı için', [
        ['Ton balığı', 120],
        ['Kinoa', 150],
        ['Avokado', 60],
        ['Mantar', 100]
      ])
    ];

    res.json({
      remainingCalories,
      goal,
      plans
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get food by name
router.get('/:name', async (req, res) => {
  try {
    const food = await get('SELECT * FROM food_database WHERE name = ?', [req.params.name]);
    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }
    res.json(food);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate nutrition for a serving
router.post('/calculate', (req, res) => {
  try {
    const { calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, portion_grams } = req.body;

    const multiplier = portion_grams / 100;

    res.json({
      calories: Math.round(calories_per_100g * multiplier),
      protein: parseFloat((protein_per_100g * multiplier).toFixed(1)),
      carbs: parseFloat((carbs_per_100g * multiplier).toFixed(1)),
      fat: parseFloat((fat_per_100g * multiplier).toFixed(1))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
