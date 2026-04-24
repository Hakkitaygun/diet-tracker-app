const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');

// Get all foods with optional search
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = 'SELECT * FROM food_database';
    let params = [];

    if (search) {
      query += ' WHERE name LIKE ?';
      params.push(`%${search}%`);
    }
    if (category) {
      query += search ? ' AND category = ?' : ' WHERE category = ?';
      params.push(category);
    }

    const foods = await all(query, params);
    res.json(foods);
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

// Get food categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await all('SELECT DISTINCT category FROM food_database ORDER BY category');
    res.json(categories.map(c => c.category));
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
