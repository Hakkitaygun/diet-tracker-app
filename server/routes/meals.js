const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

// Get local date in YYYY-MM-DD format (not UTC)
const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Add a new meal
router.post('/', async (req, res) => {
  try {
    const { user_id, meal_type, date } = req.body;
    
    if (!user_id || !meal_type) {
      return res.status(400).json({ error: 'user_id and meal_type are required' });
    }

    const result = await run(
      'INSERT INTO meals (user_id, meal_type, date) VALUES (?, ?, ?)',
      [user_id, meal_type, date || getLocalDate()]
    );

    res.json({ id: result.id, message: 'Meal created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get meals for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM meals WHERE user_id = ?';
    let params = [req.params.userId];

    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    query += ' ORDER BY created_at DESC';
    const meals = await all(query, params);
    
    // Get meal items for each meal
    for (let meal of meals) {
      meal.items = await all('SELECT * FROM meal_items WHERE meal_id = ?', [meal.id]);
    }

    res.json(meals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single meal with items
router.get('/:mealId', async (req, res) => {
  try {
    const meal = await get('SELECT * FROM meals WHERE id = ?', [req.params.mealId]);
    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    meal.items = await all('SELECT * FROM meal_items WHERE meal_id = ?', [meal.id]);
    res.json(meal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add item to meal
router.post('/:mealId/items', async (req, res) => {
  try {
    const { food_name, calories, protein, carbs, fat, portion_size } = req.body;
    
    if (!food_name || !calories) {
      return res.status(400).json({ error: 'food_name and calories are required' });
    }

    const result = await run(
      `INSERT INTO meal_items (meal_id, food_name, calories, protein, carbs, fat, portion_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.mealId, food_name, calories, protein || 0, carbs || 0, fat || 0, portion_size || '']
    );

    // Update daily summary
    const meal = await get('SELECT * FROM meals WHERE id = ?', [req.params.mealId]);
    const today = meal.date;
    
    const existingSummary = await get(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?',
      [meal.user_id, today]
    );

    if (existingSummary) {
      await run(
        `UPDATE daily_summary 
         SET total_calories = total_calories + ?,
             total_protein = total_protein + ?,
             total_carbs = total_carbs + ?,
             total_fat = total_fat + ?
         WHERE user_id = ? AND date = ?`,
        [calories, protein || 0, carbs || 0, fat || 0, meal.user_id, today]
      );
    } else {
      await run(
        `INSERT INTO daily_summary (user_id, date, total_calories, total_protein, total_carbs, total_fat)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [meal.user_id, today, calories, protein || 0, carbs || 0, fat || 0]
      );
    }

    res.json({ id: result.id, message: 'Item added to meal' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily summary
router.get('/summary/:userId', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || getLocalDate();

    const summary = await get(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?',
      [req.params.userId, targetDate]
    );

    if (!summary) {
      return res.json({
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        date: targetDate
      });
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
