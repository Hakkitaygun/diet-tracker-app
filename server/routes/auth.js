const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { get, run } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'diet-tracker-dev-secret';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
};

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const createToken = (user) => jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

function calculateBMR(age, gender, height, weight) {
  let bmr;

  if (gender === 'male') {
    bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }

  return Math.round(bmr * 1.55);
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, age, gender, height, weight, goal, daily_calorie_goal } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existingUser = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let calorieGoal = daily_calorie_goal;
    if (!calorieGoal && age && height && weight && gender) {
      calorieGoal = calculateBMR(age, gender, height, weight);
    }

    const result = await run(
      `INSERT INTO users (name, email, password_hash, age, gender, height, weight, goal, daily_calorie_goal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email.toLowerCase(),
        passwordHash,
        age || null,
        gender || null,
        height || null,
        weight || null,
        goal || 'balanced',
        calorieGoal || 2000
      ]
    );

    const user = await get('SELECT * FROM users WHERE id = ?', [result.id]);

    res.json({
      token: createToken(user),
      user: sanitizeUser(user),
      message: 'User registered successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      token: createToken(user),
      user: sanitizeUser(user),
      message: 'Login successful'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.auth.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, authMiddleware, sanitizeUser };