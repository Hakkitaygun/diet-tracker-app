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

// Create a new user
router.post('/', async (req, res) => {
  try {
    const { name, age, gender, height, weight, goal, daily_calorie_goal } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Calculate recommended daily calorie goal if not provided
    let calorieGoal = daily_calorie_goal;
    if (!calorieGoal && age && height && weight && gender) {
      calorieGoal = calculateBMR(age, gender, height, weight);
    }

    const result = await run(
      `INSERT INTO users (name, age, gender, height, weight, goal, daily_calorie_goal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, age || null, gender || null, height || null, weight || null, goal || 'balanced', calorieGoal || 2000]
    );

    res.json({
      id: result.id,
      message: 'User created successfully',
      daily_calorie_goal: calorieGoal || 2000
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/:userId', async (req, res) => {
  try {
    const { name, age, gender, height, weight, goal, daily_calorie_goal } = req.body;

    await run(
      `UPDATE users 
       SET name = COALESCE(?, name),
           age = COALESCE(?, age),
           gender = COALESCE(?, gender),
           height = COALESCE(?, height),
           weight = COALESCE(?, weight),
           goal = COALESCE(?, goal),
           daily_calorie_goal = COALESCE(?, daily_calorie_goal),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, age, gender, height, weight, goal, daily_calorie_goal, req.params.userId]
    );

    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.userId]);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record weight
router.post('/:userId/weight', async (req, res) => {
  try {
    const { weight, date, notes } = req.body;

    if (!weight) {
      return res.status(400).json({ error: 'Weight is required' });
    }

    const result = await run(
      `INSERT INTO health_metrics (user_id, date, weight, notes)
       VALUES (?, ?, ?, ?)`,
      [req.params.userId, date || new Date().toISOString().split('T')[0], weight, notes || '']
    );

    // Update user's current weight
    await run('UPDATE users SET weight = ? WHERE id = ?', [weight, req.params.userId]);

    res.json({ id: result.id, message: 'Weight recorded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weight history
router.get('/:userId/weight-history', async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const history = await all(
      `SELECT * FROM health_metrics 
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      [req.params.userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user dashboard data
router.get('/:userId/dashboard', async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const today = getLocalDate();
    const summary = await get(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?',
      [req.params.userId, today]
    );

    const weeklyData = await all(
      `SELECT * FROM daily_summary 
       WHERE user_id = ? AND date BETWEEN date('now', '-7 days') AND date('now')
       ORDER BY date DESC`,
      [req.params.userId]
    );

    const recentMetrics = await all(
      `SELECT * FROM health_metrics 
       WHERE user_id = ? 
       ORDER BY date DESC 
       LIMIT 5`,
      [req.params.userId]
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        goal: user.goal,
        daily_calorie_goal: user.daily_calorie_goal,
        current_weight: user.weight
      },
      today: summary || {
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0
      },
      weeklyAverage: calculateWeeklyAverage(weeklyData),
      recentWeights: recentMetrics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions

function calculateBMR(age, gender, height, weight) {
  // Harris-Benedict equation for BMR
  let bmr;

  if (gender === 'male') {
    bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }

  // Adjust based on activity level (moderate activity factor = 1.55)
  return Math.round(bmr * 1.55);
}

function calculateWeeklyAverage(weeklyData) {
  if (weeklyData.length === 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };
  }

  const totals = weeklyData.reduce((acc, day) => ({
    calories: acc.calories + day.total_calories,
    protein: acc.protein + day.total_protein,
    carbs: acc.carbs + day.total_carbs,
    fat: acc.fat + day.total_fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    calories: Math.round(totals.calories / weeklyData.length),
    protein: Math.round(totals.protein / weeklyData.length),
    carbs: Math.round(totals.carbs / weeklyData.length),
    fat: Math.round(totals.fat / weeklyData.length)
  };
}

module.exports = router;
