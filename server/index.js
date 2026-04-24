const express = require('express');
const cors = require('cors');
require('dotenv').config();
const foodRoutes = require('./routes/food');
const mealRoutes = require('./routes/meals');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const { initializeDatabase } = require('./database');
const { initializeFoodDatabase } = require('./foodDatabase');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const startServer = async () => {
  await initializeDatabase();
  await initializeFoodDatabase();

  // Routes
  app.use('/api/food', foodRoutes);
  app.use('/api/meals', mealRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/auth', authRoutes.router);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'API is running' });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});
