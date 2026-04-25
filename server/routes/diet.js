const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

const WEEK_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);

  const raw = String(value).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch (error) {
    // Fall through to comma-separated parsing.
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toJsonText = (value) => JSON.stringify(parseList(value));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const calcPortionNutrition = (food, grams) => {
  const multiplier = grams / 100;
  return {
    calories: Math.round((food.calories_per_100g || 0) * multiplier),
    protein: parseFloat(((food.protein_per_100g || 0) * multiplier).toFixed(1)),
    carbs: parseFloat(((food.carbs_per_100g || 0) * multiplier).toFixed(1)),
    fat: parseFloat(((food.fat_per_100g || 0) * multiplier).toFixed(1))
  };
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const foldForMatch = (value) => normalize(value)
  .replace(/ı/g, 'i')
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ş/g, 's')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c');

const findCatalogKeyByName = (catalog, name) => {
  const query = normalize(name);
  const foldedQuery = foldForMatch(name);
  if (!query) return null;
  if (catalog[query]) return query;

  const keys = Object.keys(catalog);
  const foldedKeys = keys.map((key) => ({
    key,
    folded: foldForMatch(key)
  }));

  const foldedExact = foldedKeys.find((entry) => entry.folded === foldedQuery);
  if (foldedExact) return foldedExact.key;

  const directContains = keys.find((key) => query.includes(key) || key.includes(query));
  if (directContains) return directContains;

  const foldedContains = foldedKeys.find(
    (entry) => foldedQuery.includes(entry.folded) || entry.folded.includes(foldedQuery)
  );
  if (foldedContains) return foldedContains.key;

  // Common Turkish meal naming shortcut: "pilav" should prefer rice-like catalog items.
  if (foldedQuery.includes('pilav')) {
    const pilavPreferred = foldedKeys.find(
      (entry) => entry.folded.includes('pirinc') || entry.folded.includes('bulgur')
    );
    if (pilavPreferred) return pilavPreferred.key;
  }

  const tokens = query.split(/\s+/).filter((token) => token.length >= 3);
  const foldedTokens = foldedQuery.split(/\s+/).filter((token) => token.length >= 3);
  for (const token of tokens) {
    const tokenMatch = keys.find((key) => key === token || key.includes(token) || token.includes(key));
    if (tokenMatch) return tokenMatch;
  }

  for (const token of foldedTokens) {
    const tokenMatch = foldedKeys.find(
      (entry) => entry.folded === token || entry.folded.includes(token) || token.includes(entry.folded)
    );
    if (tokenMatch) return tokenMatch.key;
  }

  return null;
};

const getCatalogItemByName = (catalog, name) => {
  const key = findCatalogKeyByName(catalog, name);
  return key ? catalog[key] : null;
};

const getUser = async (userId) => get('SELECT * FROM users WHERE id = ?', [userId]);

const getPreferences = async (userId) => {
  const prefs = await get('SELECT * FROM diet_preferences WHERE user_id = ?', [userId]);
  return prefs || {
    user_id: userId,
    favorite_foods: '[]',
    banned_foods: '[]',
    diet_style: 'balanced',
    notes: ''
  };
};

const savePreferences = async (userId, payload) => {
  const existing = await get('SELECT * FROM diet_preferences WHERE user_id = ?', [userId]);
  const favorite_foods = toJsonText(payload.favorite_foods || []);
  const banned_foods = toJsonText(payload.banned_foods || []);
  const diet_style = payload.diet_style || 'balanced';
  const notes = payload.notes || '';

  if (existing) {
    await run(
      `UPDATE diet_preferences
       SET favorite_foods = ?,
           banned_foods = ?,
           diet_style = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [favorite_foods, banned_foods, diet_style, notes, userId]
    );
  } else {
    await run(
      `INSERT INTO diet_preferences (user_id, favorite_foods, banned_foods, diet_style, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, favorite_foods, banned_foods, diet_style, notes]
    );
  }

  return getPreferences(userId);
};

const loadCatalog = async () => {
  const foods = await all(
    `SELECT name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category, description
     FROM food_database
     ORDER BY category, name`
  );

  return foods.reduce((acc, food) => {
    acc[normalize(food.name)] = food;
    return acc;
  }, {});
};

const resolveFood = (catalog, preferredNames, grams, prefs) => {
  const banned = new Set(parseList(prefs.banned_foods).map(normalize));
  const favorites = new Set(parseList(prefs.favorite_foods).map(normalize));

  const pick = (name) => {
    const key = normalize(name);
    const item = catalog[key];
    if (!item || banned.has(key)) return null;
    return {
      name: item.name,
      grams,
      ...calcPortionNutrition(item, grams),
      category: item.category
    };
  };

  for (const name of preferredNames) {
    const candidate = pick(name);
    if (candidate) return candidate;
  }

  const favoriteMatch = Object.keys(catalog).find((name) => favorites.has(name) && !banned.has(name));
  if (favoriteMatch) {
    return pick(catalog[favoriteMatch].name);
  }

  return pick(preferredNames[0]);
};

const buildMeal = (title, specs, catalog, prefs) => {
  const items = specs
    .map((spec) => resolveFood(catalog, spec.candidates, spec.grams, prefs))
    .filter(Boolean);

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: parseFloat((acc.protein + item.protein).toFixed(1)),
      carbs: parseFloat((acc.carbs + item.carbs).toFixed(1)),
      fat: parseFloat((acc.fat + item.fat).toFixed(1))
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    title,
    totals,
    items
  };
};

const buildGoalPrograms = (user, prefs) => {
  const activeGoal = user?.goal || prefs?.diet_style || 'balanced';
  const calorieGoal = user?.daily_calorie_goal || 2000;

  return [
    {
      id: 'weight_loss',
      title: 'Kilo Verme Programı',
      active: activeGoal === 'weight_loss',
      targetCalories: clamp(Math.round(calorieGoal - 400), 1200, calorieGoal),
      focus: 'Yüksek protein, kontrollü karbonhidrat, bol lif',
      rules: ['Şekerli içecekleri çıkar', 'Her ana öğünde protein kullan', 'Sebzeyi tabağın yarısına çıkar'],
      dailyExample: 'Yumurta, tavuk, yoğurt, bulgur, salata ve kefir odaklı plan'
    },
    {
      id: 'muscle_gain',
      title: 'Kas Kazanma Programı',
      active: activeGoal === 'muscle_gain',
      targetCalories: Math.round(calorieGoal + 250),
      focus: 'Yeterli enerji, güçlü protein, antrenman sonrası toparlanma',
      rules: ['Gün içine 3 ana + 2 ara öğün yay', 'Antrenman sonrası protein al', 'Sağlıklı yağları artır'],
      dailyExample: 'Yumurta, hindi, somon, kinoa, yulaf ve lor peyniri odaklı plan'
    },
    {
      id: 'balanced',
      title: 'Dengeli Sağlık Programı',
      active: activeGoal === 'balanced' || activeGoal === 'health',
      targetCalories: calorieGoal,
      focus: 'Uzun vadeli sürdürülebilirlik ve öğün dengesi',
      rules: ['Renkli sebze çeşitliliği kur', 'Protein kaynaklarını değiştir', 'Aşırı kısıtlama yapma'],
      dailyExample: 'Balık, baklagil, yoğurt, tam tahıl, meyve ve sebze dengesi'
    }
  ];
};

const buildWeeklyPlan = (user, prefs, catalog) => {
  const goal = user?.goal || prefs?.diet_style || 'balanced';
  const templates = {
    weight_loss: [
      {
        breakfast: [
          { candidates: ['Yumurta', 'Lor peyniri'], grams: 120 },
          { candidates: ['Salata', 'Domates', 'Salatalık'], grams: 120 },
          { candidates: ['Tam buğday ekmeği', 'Yulaf ezmesi'], grams: 50 }
        ],
        lunch: [
          { candidates: ['Tavuk göğsü', 'Hindi göğsü'], grams: 150 },
          { candidates: ['Bulgur', 'Mercimek'], grams: 140 },
          { candidates: ['Salata', 'Ispanak'], grams: 120 }
        ],
        dinner: [
          { candidates: ['Ton balığı', 'Balık'], grams: 130 },
          { candidates: ['Kabak', 'Mantar', 'Broccoli'], grams: 150 },
          { candidates: ['Yoğurt', 'Kefir'], grams: 150 }
        ],
        snack: [
          { candidates: ['Kefir', 'Çilek', 'Elma'], grams: 200 },
          { candidates: ['Badem', 'Ceviz'], grams: 20 }
        ]
      },
      {
        breakfast: [
          { candidates: ['Yulaf ezmesi'], grams: 50 },
          { candidates: ['Yoğurt', 'Kefir'], grams: 170 },
          { candidates: ['Çilek', 'Elma'], grams: 80 }
        ],
        lunch: [
          { candidates: ['Hindi göğsü', 'Tavuk göğsü'], grams: 150 },
          { candidates: ['Bulgur'], grams: 120 },
          { candidates: ['Salata', 'Domates'], grams: 120 }
        ],
        dinner: [
          { candidates: ['Mercimek', 'Nohut'], grams: 150 },
          { candidates: ['Ispanak', 'Kabak'], grams: 140 },
          { candidates: ['Yoğurt'], grams: 100 }
        ],
        snack: [
          { candidates: ['Lor peyniri'], grams: 80 },
          { candidates: ['Salatalık'], grams: 100 }
        ]
      }
    ],
    muscle_gain: [
      {
        breakfast: [
          { candidates: ['Yumurta'], grams: 150 },
          { candidates: ['Yulaf ezmesi'], grams: 70 },
          { candidates: ['Kefir', 'Yoğurt'], grams: 200 }
        ],
        lunch: [
          { candidates: ['Tavuk göğsü', 'Hindi göğsü'], grams: 180 },
          { candidates: ['Tam buğday makarna', 'Bulgur'], grams: 180 },
          { candidates: ['Salata'], grams: 120 }
        ],
        dinner: [
          { candidates: ['Somon', 'Balık'], grams: 160 },
          { candidates: ['Kinoa', 'Pirinç'], grams: 160 },
          { candidates: ['Ispanak', 'Mantar'], grams: 140 }
        ],
        snack: [
          { candidates: ['Lor peyniri'], grams: 100 },
          { candidates: ['Badem', 'Fındık'], grams: 25 },
          { candidates: ['Muz'], grams: 100 }
        ]
      },
      {
        breakfast: [
          { candidates: ['Yumurta', 'Lor peyniri'], grams: 160 },
          { candidates: ['Tam buğday ekmeği'], grams: 60 },
          { candidates: ['Muz', 'Portakal'], grams: 100 }
        ],
        lunch: [
          { candidates: ['Kırmızı et', 'Tavuk göğsü'], grams: 170 },
          { candidates: ['Pirinç', 'Bulgur'], grams: 180 },
          { candidates: ['Salata'], grams: 120 }
        ],
        dinner: [
          { candidates: ['Hindi göğsü', 'Ton balığı'], grams: 150 },
          { candidates: ['Mercimek', 'Nohut'], grams: 160 },
          { candidates: ['Broccoli', 'Kabak'], grams: 140 }
        ],
        snack: [
          { candidates: ['Kefir'], grams: 250 },
          { candidates: ['Ceviz'], grams: 20 }
        ]
      }
    ],
    balanced: [
      {
        breakfast: [
          { candidates: ['Yumurta'], grams: 120 },
          { candidates: ['Tam buğday ekmeği', 'Yulaf ezmesi'], grams: 60 },
          { candidates: ['Domates', 'Salatalık'], grams: 120 }
        ],
        lunch: [
          { candidates: ['Tavuk göğsü', 'Balık'], grams: 140 },
          { candidates: ['Bulgur', 'Pirinç'], grams: 150 },
          { candidates: ['Salata'], grams: 120 }
        ],
        dinner: [
          { candidates: ['Mercimek', 'Nohut'], grams: 160 },
          { candidates: ['Yoğurt'], grams: 150 },
          { candidates: ['Ispanak', 'Kabak'], grams: 120 }
        ],
        snack: [
          { candidates: ['Elma', 'Çilek'], grams: 120 },
          { candidates: ['Badem', 'Ceviz'], grams: 15 }
        ]
      },
      {
        breakfast: [
          { candidates: ['Kefir', 'Yoğurt'], grams: 220 },
          { candidates: ['Yulaf ezmesi'], grams: 50 },
          { candidates: ['Çilek', 'Elma'], grams: 80 }
        ],
        lunch: [
          { candidates: ['Hindi göğsü', 'Ton balığı'], grams: 150 },
          { candidates: ['Kinoa', 'Bulgur'], grams: 150 },
          { candidates: ['Salata'], grams: 120 }
        ],
        dinner: [
          { candidates: ['Somon', 'Balık'], grams: 140 },
          { candidates: ['Mantar', 'Broccoli'], grams: 140 },
          { candidates: ['Tam buğday ekmeği'], grams: 40 }
        ],
        snack: [
          { candidates: ['Lor peyniri'], grams: 70 },
          { candidates: ['Portakal'], grams: 100 }
        ]
      }
    ]
  };

  const source = templates[goal] || templates.balanced;
  const days = WEEK_DAYS.map((dayName, index) => {
    const template = source[index % source.length];
    const meals = [
      buildMeal('Kahvaltı', template.breakfast, catalog, prefs),
      buildMeal('Öğle', template.lunch, catalog, prefs),
      buildMeal('Akşam', template.dinner, catalog, prefs),
      buildMeal('Ara Öğün', template.snack, catalog, prefs)
    ];

    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.totals.calories,
        protein: parseFloat((acc.protein + meal.totals.protein).toFixed(1)),
        carbs: parseFloat((acc.carbs + meal.totals.carbs).toFixed(1)),
        fat: parseFloat((acc.fat + meal.totals.fat).toFixed(1))
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      day: dayName,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      meals
    };
  });

  return {
    goal,
    activeGoalCalories: user?.daily_calorie_goal || 2000,
    days
  };
};

const buildShoppingList = (weeklyPlan, prefs, catalog) => {
  const aggregated = new Map();
  const banned = new Set(parseList(prefs?.banned_foods).map(normalize));

  const addItem = (item, grams, calories) => {
    if (!item) return;
    const current = aggregated.get(item.name) || { grams: 0, calories: 0, category: item.category };
    current.grams += grams;
    current.calories += calories;
    aggregated.set(item.name, current);
  };

  weeklyPlan.days.forEach((day) => {
    day.meals.forEach((meal) => {
      meal.items.forEach((item) => {
        addItem(item, item.grams, item.calories);
      });
    });
  });

  parseList(prefs?.favorite_foods).forEach((favoriteName) => {
    const catalogItem = getCatalogItemByName(catalog, favoriteName);
    if (catalogItem && !banned.has(normalize(catalogItem.name))) {
      addItem(catalogItem, 100, Math.round((catalogItem.calories_per_100g || 0)));
    }
  });

  return Array.from(aggregated.entries())
    .map(([name, data]) => ({
      name,
      category: data.category,
      grams: Math.round(data.grams),
      calories: Math.round(data.calories)
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
};

router.get('/overview/:userId', async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prefs = await getPreferences(req.params.userId);
    const catalog = await loadCatalog();
    const programs = buildGoalPrograms(user, prefs);
    const weeklyPlan = buildWeeklyPlan(user, prefs, catalog);
    const shoppingList = buildShoppingList(weeklyPlan, prefs, catalog);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        goal: user.goal,
        daily_calorie_goal: user.daily_calorie_goal
      },
      preferences: {
        favorite_foods: parseList(prefs.favorite_foods),
        banned_foods: parseList(prefs.banned_foods),
        diet_style: prefs.diet_style || 'balanced',
        notes: prefs.notes || ''
      },
      programs,
      weeklyPlan,
      shoppingList
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/preferences/:userId', async (req, res) => {
  try {
    const prefs = await getPreferences(req.params.userId);
    res.json({
      favorite_foods: parseList(prefs.favorite_foods),
      banned_foods: parseList(prefs.banned_foods),
      diet_style: prefs.diet_style || 'balanced',
      notes: prefs.notes || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/preferences/:userId', async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const saved = await savePreferences(req.params.userId, req.body);
    res.json({
      favorite_foods: parseList(saved.favorite_foods),
      banned_foods: parseList(saved.banned_foods),
      diet_style: saved.diet_style || 'balanced',
      notes: saved.notes || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/programs/:userId', async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prefs = await getPreferences(req.params.userId);
    res.json({
      programs: buildGoalPrograms(user, prefs)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly/:userId', async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prefs = await getPreferences(req.params.userId);
    const catalog = await loadCatalog();
    res.json(buildWeeklyPlan(user, prefs, catalog));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/shopping-list/:userId', async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prefs = await getPreferences(req.params.userId);
    const catalog = await loadCatalog();
    const weeklyPlan = buildWeeklyPlan(user, prefs, catalog);
    res.json({
      items: buildShoppingList(weeklyPlan)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
