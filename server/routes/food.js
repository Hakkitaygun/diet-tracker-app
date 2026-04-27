const express = require('express');
const router = express.Router();
const axios = require('axios');
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

const QUERY_STOP_WORDS = new Set([
  've', 'ile', 'icin', 'için', 'marka', 'urun', 'ürün', 'gida', 'gıda', 'adet', 'gram', 'ml'
]);

const BRAND_ALIAS_GROUPS = {
  pepsi: ['pepsi', 'pepsi max', 'pepsi zero'],
  coca_cola: ['coca cola', 'coca-cola', 'cocacola', 'cola'],
  fanta: ['fanta'],
  sprite: ['sprite'],
  ulker: ['ulker', 'ülker'],
  eti: ['eti'],
  nestle: ['nestle', 'nestlé'],
  kelloggs: ['kelloggs', 'kellogg']
};

const tokenizeForMatch = (value) => normalizeForSearch(value)
  .split(/\s+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 3 && !QUERY_STOP_WORDS.has(token));

const detectBrandKey = (value) => {
  const folded = normalizeForSearch(value);
  const found = Object.entries(BRAND_ALIAS_GROUPS).find(([, aliases]) =>
    aliases.some((alias) => folded.includes(normalizeForSearch(alias)))
  );
  return found ? found[0] : null;
};

const queryWantsZeroVariant = (query) => {
  const folded = normalizeForSearch(query);
  return (
    folded.includes('zero') ||
    folded.includes('light') ||
    folded.includes('diet') ||
    folded.includes('sekersiz') ||
    folded.includes('seker ilavesiz') ||
    folded.includes('sugar free')
  );
};

const candidateLooksZeroVariant = (candidate) => {
  const text = normalizeForSearch(`${candidate?.name || ''} ${candidate?.description || ''}`);
  const hasZeroText = (
    text.includes('zero') ||
    text.includes('light') ||
    text.includes('diet') ||
    text.includes('sekersiz') ||
    text.includes('sugar free')
  );

  if (hasZeroText) return true;

  const calories = Number(candidate?.calories_per_100g) || 0;
  const carbs = Number(candidate?.carbs_per_100g) || 0;
  return calories <= 12 && carbs <= 3;
};

const isAiCandidateRelevantToQuery = (candidate, query) => {
  if (!candidate || !query) return false;

  const foldedQuery = normalizeForSearch(query);
  const foldedName = normalizeForSearch(candidate.name);
  const foldedDescription = normalizeForSearch(candidate.description || '');
  const candidateText = `${foldedName} ${foldedDescription}`.trim();

  if (!candidateText) return false;

  const queryBrand = detectBrandKey(foldedQuery);
  const candidateBrand = detectBrandKey(candidateText);
  if (queryBrand && queryBrand !== candidateBrand) {
    return false;
  }

  const queryTokens = tokenizeForMatch(query);
  const overlapCount = queryTokens.filter((token) => candidateText.includes(token)).length;

  const hasDirectMatch = (
    candidateText.includes(foldedQuery) ||
    foldedQuery.includes(foldedName)
  );

  const tokenMatchOk = queryTokens.length <= 1 ? overlapCount >= 1 : overlapCount >= 1;
  if (!hasDirectMatch && !tokenMatchOk) {
    return false;
  }

  if (queryWantsZeroVariant(query) && !candidateLooksZeroVariant(candidate)) {
    return false;
  }

  return true;
};

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

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickFirstFinite = (...values) => {
  for (const value of values) {
    const num = toFiniteNumber(value);
    if (num !== null) return num;
  }
  return null;
};

const detectCategoryFromText = (value) => {
  const text = normalizeForSearch(value);
  if (text.includes('beverage') || text.includes('drink') || text.includes('icecek') || text.includes('içecek')) return 'İçecekler';
  if (text.includes('cereal') || text.includes('breakfast') || text.includes('gevrek')) return 'Tahıllar';
  if (text.includes('chocolate') || text.includes('sweet') || text.includes('tatli') || text.includes('tatlı')) return 'Tatlılar';
  if (text.includes('dairy') || text.includes('milk') || text.includes('süt')) return 'Süt Ürünleri';
  return 'Hazır Gıdalar';
};

const getOpenFoodFactsSuggestion = async (searchText) => {
  try {
    const foldedQuery = normalizeForSearch(searchText);
    if (!foldedQuery || foldedQuery.length < 3) return null;

    const response = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
      params: {
        search_terms: searchText,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: 12,
        fields: 'product_name,brands,quantity,categories,categories_tags,nutriments'
      },
      timeout: 7000
    });

    const products = Array.isArray(response.data?.products) ? response.data.products : [];
    if (products.length === 0) return null;

    const scored = products
      .map((product) => {
        const productName = String(product.product_name || '').trim();
        if (!productName) return null;

        const foldedName = normalizeForSearch(productName);
        const nutriments = product.nutriments || {};
        const kcal = pickFirstFinite(
          nutriments['energy-kcal_100g'],
          nutriments['energy-kcal_100ml'],
          nutriments['energy-kcal_value']
        );

        if (kcal === null || kcal <= 0) return null;

        const protein = pickFirstFinite(nutriments.proteins_100g, nutriments.proteins_100ml) || 0;
        const carbs = pickFirstFinite(nutriments.carbohydrates_100g, nutriments.carbohydrates_100ml) || 0;
        const fat = pickFirstFinite(nutriments.fat_100g, nutriments.fat_100ml) || 0;

        const score = [
          foldedName === foldedQuery ? 100 : 0,
          foldedName.includes(foldedQuery) ? 40 : 0,
          normalizeForSearch(product.brands || '').includes(foldedQuery) ? 25 : 0,
          kcal > 0 ? 10 : 0
        ].reduce((a, b) => a + b, 0);

        return {
          product,
          productName,
          score,
          nutrition: { kcal, protein, carbs, fat }
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 10) return null;

    const brand = String(best.product.brands || '').split(',')[0].trim();
    const displayName = brand ? `${best.productName} (${brand})` : best.productName;
    const categoryHint = Array.isArray(best.product.categories_tags)
      ? best.product.categories_tags.join(' ')
      : String(best.product.categories || '');

    return {
      name: displayName.slice(0, 64),
      category: detectCategoryFromText(categoryHint),
      description: `OpenFoodFacts kaynagi${best.product.quantity ? ` - ${best.product.quantity}` : ''}`.trim(),
      calories_per_100g: Math.max(1, Math.min(900, Math.round(best.nutrition.kcal))),
      protein_per_100g: Math.max(0, Math.min(100, Number(best.nutrition.protein.toFixed(1)))),
      carbs_per_100g: Math.max(0, Math.min(100, Number(best.nutrition.carbs.toFixed(1)))),
      fat_per_100g: Math.max(0, Math.min(100, Number(best.nutrition.fat.toFixed(1)))),
      confidence: best.score >= 70 ? 'high' : 'medium'
    };
  } catch (error) {
    return null;
  }
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

    // User search input is handled by AI API directly.
    if (searchText) {
      const tryBuildResponse = (rawFood) => {
        const candidate = sanitizeAiFood(rawFood);
        const valid = isValidAiFood(candidate) && isAiCandidateRelevantToQuery(candidate, searchText);
        if (!valid) return null;

        return [
          {
            ...candidate,
            ai_generated: true,
            source: 'ai-api',
            transient: true,
            confidence: candidate.confidence || 'medium'
          }
        ];
      };

      const aiResult = await getAIFoodSuggestion(searchText);
      const firstResponse = aiResult?.success && aiResult.food ? tryBuildResponse(aiResult.food) : null;
      if (firstResponse) {
        return res.json(firstResponse);
      }

      const strictPromptQuery = `${searchText} (tam olarak bu urun/marka, varyanti dogru olsun)`;
      const retryAiResult = await getAIFoodSuggestion(strictPromptQuery);
      const secondResponse = retryAiResult?.success && retryAiResult.food ? tryBuildResponse(retryAiResult.food) : null;
      if (secondResponse) {
        return res.json(secondResponse);
      }

      return res.json([]);
    }

    let query = 'SELECT * FROM food_database';
    let params = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name LIMIT ?';
    params.push(safeLimit);

    let foods = await all(query, params);
    foods = foods.filter((food) => !isSuspiciousGeneratedFood(food));

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
