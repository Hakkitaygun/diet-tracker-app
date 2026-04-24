const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database');
const {
  getAIDietRecommendations,
  getAIMealSuggestions,
  getAIAnalysis,
  getAIChatResponse
} = require('../geminiService');

// Get local date in YYYY-MM-DD format (not UTC)
const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Simple in-memory cache to reduce repeated AI calls
const aiCache = {
  recommendations: new Map(),
  suggestions: new Map(),
  analytics: new Map()
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '12', 10);

function getCache(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(map, key, data) {
  map.set(key, { data, timestamp: Date.now() });
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getAiUsage(userId) {
  const usageDate = getTodayString();
  const row = await get('SELECT * FROM ai_usage WHERE user_id = ? AND usage_date = ?', [userId, usageDate]);
  return row || { user_id: userId, usage_date: usageDate, request_count: 0 };
}

async function consumeAiQuota(userId) {
  const usageDate = getTodayString();
  const currentUsage = await getAiUsage(userId);

  if ((currentUsage.request_count || 0) >= AI_DAILY_LIMIT) {
    return {
      allowed: false,
      usage: currentUsage,
      limit: AI_DAILY_LIMIT
    };
  }

  if (currentUsage.id) {
    await run(
      `UPDATE ai_usage
       SET request_count = request_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND usage_date = ?`,
      [userId, usageDate]
    );
  } else {
    await run(
      `INSERT INTO ai_usage (user_id, usage_date, request_count)
       VALUES (?, ?, 1)`,
      [userId, usageDate]
    );
  }

  return {
    allowed: true,
    usage: {
      ...currentUsage,
      request_count: (currentUsage.request_count || 0) + 1
    },
    limit: AI_DAILY_LIMIT
  };
}

// Generate personalized AI recommendations using Gemini
router.post('/recommendations', async (req, res) => {
  try {
    const { user_id, date } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const targetDate = date || getLocalDate();

    // Get user data
    const user = await get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get today's summary
    const summary = await get(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?',
      [user_id, targetDate]
    );

    console.log(`[AI] User ${user_id}, Date ${targetDate}, Summary:`, summary);

    const dailyCalories = summary?.total_calories || 0;
    const dailyProtein = summary?.total_protein || 0;
    const dailyCarbs = summary?.total_carbs || 0;
    const dailyFat = summary?.total_fat || 0;

    const goal = user.daily_calorie_goal || 2000;
    const remainingCalories = goal - dailyCalories;

    const nutritionSignature = `${Math.round(dailyCalories)}:${Math.round(dailyProtein)}:${Math.round(dailyCarbs)}:${Math.round(dailyFat)}`;
    const cacheKey = `${user_id}:${targetDate}:${nutritionSignature}`;
    const cached = getCache(aiCache.recommendations, cacheKey);

    let aiRecommendations = cached;
    let warning = '';

    if (!aiRecommendations) {
      const quota = await consumeAiQuota(user_id);
      if (!quota.allowed) {
        return res.status(429).json({
          error: `AI günlük limit doldu (${quota.limit}). Yarın tekrar deneyin.`,
          limit: quota.limit,
          usedToday: quota.usage.request_count,
          remainingToday: 0
        });
      }

      try {
        aiRecommendations = await getAIDietRecommendations(
          user_id,
          user,
          {
            total_calories: dailyCalories,
            total_protein: dailyProtein,
            total_carbs: dailyCarbs,
            total_fat: dailyFat
          }
        );

        if (aiRecommendations?.success === false) {
          const serviceMessage = String(aiRecommendations.error || '').toLowerCase();
          const isRateLimited = serviceMessage.includes('429') || serviceMessage.includes('rate limit');

          if (isRateLimited) {
            if (cached) {
              aiRecommendations = cached;
              warning = 'Rate limit doldu. Onceki tavsiye gosteriliyor.';
            } else {
              aiRecommendations = {
                success: true,
                recommendations: '⏳ AI yogun. Kisa bir sure sonra tekrar dene. Bu arada protein odakli bir ana ogun + kompleks karbonhidrat + salata ekleyebilirsin.'
              };
              warning = 'API oran sinirlamasi. Gecici tavsiye gosteriliyor.';
            }
          } else {
            aiRecommendations = {
              success: true,
              recommendations: 'AI servisi gecici olarak ulasilamaz. Bugun hedefe yaklasmak icin: 1) Protein kaynagi ekle 2) 1 porsiyon kompleks karbonhidrat ekle 3) Sekerli iceceklerden kacin.'
            };
            warning = 'AI servisi gecici olarak kullanilamiyor. Gecici tavsiye gosteriliyor.';
          }
        }

        setCache(aiCache.recommendations, cacheKey, aiRecommendations);
      } catch (error) {
        // Handle rate limit error with cache fallback
        const is429Error = error?.response?.status === 429 || error?.message?.includes('429') || error?.message?.includes('rate limit');
        if (is429Error) {
          if (cached) {
            // Use cached data if available
            aiRecommendations = cached;
            warning = 'Rate limit doldu. Önceki tavsiye gösteriliyor.';
          } else {
            // Return friendly error message if no cache
            aiRecommendations = {
              recommendations: '⏳ AI henüz önerileri hazırlamadı. Lütfen 1-2 dakika bekleyip tekrar deneyin. (Oran sınırlaması)'
            };
            warning = 'API oran sınırlaması. Bir süre sonra tekrar deneyin.';
          }
        } else {
          throw error;
        }
      }
    }

    res.json({
      date: targetDate,
      user: {
        name: user.name,
        age: user.age,
        goal: user.goal
      },
      consumption: {
        calories: dailyCalories,
        protein: Math.round(dailyProtein),
        carbs: Math.round(dailyCarbs),
        fat: Math.round(dailyFat)
      },
      remaining: {
        calories: Math.max(0, remainingCalories),
        percentage: Math.round((dailyCalories / goal) * 100)
      },
      aiRecommendations: aiRecommendations.recommendations,
      warning,
      macroAnalysis: {
        proteinPercentage: dailyCalories > 0 ? ((dailyProtein * 4) / dailyCalories * 100).toFixed(1) : 0,
        carbPercentage: dailyCalories > 0 ? ((dailyCarbs * 4) / dailyCalories * 100).toFixed(1) : 0,
        fatPercentage: dailyCalories > 0 ? ((dailyFat * 9) / dailyCalories * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI meal suggestions
router.get('/suggestions/:userId', async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get today's consumption
    const today = getLocalDate();
    const summary = await get(
      'SELECT * FROM daily_summary WHERE user_id = ? AND date = ?',
      [req.params.userId, today]
    );

    const dailyCalories = summary?.total_calories || 0;
    const goal = user.daily_calorie_goal || 2000;
    const remainingCalories = Math.max(0, goal - dailyCalories);

    const suggestionSignature = `${Math.round(dailyCalories)}:${Math.round(remainingCalories)}:${Math.round(goal)}`;
    const cacheKey = `${req.params.userId}:${today}:${suggestionSignature}`;
    const cached = getCache(aiCache.suggestions, cacheKey);

    let aiSuggestions = cached;
    let warning = '';

    if (!aiSuggestions) {
      const quota = await consumeAiQuota(req.params.userId);
      if (!quota.allowed) {
        return res.status(429).json({
          error: `AI günlük limit doldu (${quota.limit}). Yarın tekrar deneyin.`,
          limit: quota.limit,
          usedToday: quota.usage.request_count,
          remainingToday: 0
        });
      }

      try {
        aiSuggestions = await getAIMealSuggestions(
          req.params.userId,
          user,
          dailyCalories,
          remainingCalories
        );

        if (aiSuggestions?.success === false) {
          const serviceMessage = String(aiSuggestions.error || '').toLowerCase();
          const isRateLimited = serviceMessage.includes('429') || serviceMessage.includes('rate limit');

          if (isRateLimited) {
            if (cached) {
              aiSuggestions = cached;
              warning = 'Rate limit doldu. Önceki öneriler gösteriliyor.';
            } else {
              aiSuggestions = {
                success: true,
                suggestions: buildFallbackMealSuggestions(user, dailyCalories, remainingCalories)
              };
              warning = 'API oran sınırlaması. Geçici öneriler gösteriliyor.';
            }
          } else {
            aiSuggestions = {
              success: true,
              suggestions: buildFallbackMealSuggestions(user, dailyCalories, remainingCalories)
            };
            warning = 'AI servisi geçici olarak kullanılamıyor. Geçici öneriler gösteriliyor.';
          }
        }

        setCache(aiCache.suggestions, cacheKey, aiSuggestions);
      } catch (error) {
        // Handle rate limit error with cache fallback
        const is429Error = error?.response?.status === 429 || error?.message?.includes('429') || error?.message?.includes('rate limit');
        if (is429Error) {
          if (cached) {
            // Use cached data if available
            aiSuggestions = cached;
            warning = 'Rate limit doldu. Önceki öneriler gösteriliyor.';
          } else {
            // Return friendly error message if no cache
            aiSuggestions = {
              suggestions: '⏳ AI henüz öneriler hazırlamadı. Lütfen 1-2 dakika bekleyip tekrar deneyin. (Oran sınırlaması)'
            };
            warning = 'API oran sınırlaması. Bir süre sonra tekrar deneyin.';
          }
        } else {
          throw error;
        }
      }
    }

    res.json({
      currentCalories: dailyCalories,
      remainingCalories: remainingCalories,
      dailyGoal: goal,
      aiSuggestions: aiSuggestions.suggestions,
      warning
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    // Return graceful message instead of 500 error
    const is429Error = error?.message?.includes('429') || error?.message?.includes('rate limit');
    if (is429Error) {
      return res.json({
        currentCalories: 0,
        remainingCalories: 0,
        dailyGoal: 2000,
        aiSuggestions: '⏳ AI henüz öneriler hazırlamadı. Lütfen 1-2 dakika bekleyip tekrar deneyin. (Oran sınırlaması)',
        warning: 'API oran sınırlaması. Bir süre sonra tekrar deneyin.'
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get AI nutrition analysis and weekly trends
router.get('/analytics/:userId', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const analytics = await all(
      `SELECT * FROM daily_summary 
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      [req.params.userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    const average = calculateAverages(analytics);

    const cacheKey = `${req.params.userId}:${days}`;
    const cached = getCache(aiCache.analytics, cacheKey);

    let aiAnalysis = cached;
    let warning = '';

    if (!aiAnalysis) {
      const quota = await consumeAiQuota(req.params.userId);
      if (!quota.allowed) {
        return res.status(429).json({
          error: `AI günlük limit doldu (${quota.limit}). Yarın tekrar deneyin.`,
          limit: quota.limit,
          usedToday: quota.usage.request_count,
          remainingToday: 0
        });
      }

      try {
        aiAnalysis = await getAIAnalysis(
          req.params.userId,
          user,
          average
        );
        setCache(aiCache.analytics, cacheKey, aiAnalysis);
      } catch (error) {
        if (cached && error?.message?.includes('429')) {
          aiAnalysis = cached;
          warning = 'Rate limit doldu. Onceki analiz gosteriliyor.';
        } else {
          throw error;
        }
      }
    }

    res.json({
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: parseInt(days)
      },
      daily: analytics,
      average: average,
      trends: calculateTrends(analytics),
      aiAnalysis: aiAnalysis.analysis,
      warning
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions

function calculateAverages(analytics) {
  if (!analytics || analytics.length === 0) {
    return {
      avg_calories: 0,
      avg_protein: 0,
      avg_carbs: 0,
      avg_fat: 0
    };
  }

  const sum = analytics.reduce((acc, day) => ({
    calories: acc.calories + (day.total_calories || 0),
    protein: acc.protein + (day.total_protein || 0),
    carbs: acc.carbs + (day.total_carbs || 0),
    fat: acc.fat + (day.total_fat || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    avg_calories: sum.calories / analytics.length,
    avg_protein: sum.protein / analytics.length,
    avg_carbs: sum.carbs / analytics.length,
    avg_fat: sum.fat / analytics.length
  };
}

function calculateTrends(analytics) {
  if (!analytics || analytics.length < 2) {
    return {
      caloriesTrend: 'stable',
      direction: 'none'
    };
  }

  const recent = analytics.slice(0, Math.ceil(analytics.length / 2));
  const older = analytics.slice(Math.ceil(analytics.length / 2));

  const recentAvg = recent.reduce((sum, day) => sum + (day.total_calories || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, day) => sum + (day.total_calories || 0), 0) / older.length;

  const difference = recentAvg - olderAvg;
  const percentChange = ((difference / olderAvg) * 100).toFixed(1);

  return {
    caloriesTrend: Math.abs(difference) < 100 ? 'stable' : difference > 0 ? 'increasing' : 'decreasing',
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable',
    percentChange: Math.abs(percentChange),
    recentAverage: Math.round(recentAvg),
    olderAverage: Math.round(olderAvg)
  };
}

function buildFallbackMealSuggestions(user, currentCalories, remainingCalories) {
  const goal = user?.goal || 'maintain';
  const safeRemaining = Math.max(0, Number(remainingCalories) || 0);

  let goalHint = 'dengeyi koru';
  if (goal === 'weight_loss') goalHint = 'kalori acigini kontrollu tut';
  if (goal === 'muscle_gain') goalHint = 'proteini yuksek tut';

  return [
    'Durum Ozeti',
    `- Su an tuketilen: ${Math.round(currentCalories || 0)} kcal`,
    `- Kalan hedef: ${Math.round(safeRemaining)} kcal`,
    `- Bugun icin odak: ${goalHint}`,
    '',
    'Hizli Oneriler (AI gecici olarak sinirli oldugu icin kural tabanli)',
    '- Izgara tavuk + bulgur + yogurt (yaklasik 500-650 kcal)',
    '- Ton balikli tam bugday sandvic + ayran (yaklasik 400-550 kcal)',
    '- Mercimek corbasi + zeytinyagli salata + tam tahilli ekmek (yaklasik 350-500 kcal)',
    '',
    'Kisa Not',
    '- Tabagini protein + kompleks karbonhidrat + sebze seklinde kur.'
  ].join('\n');
}

// AI Chat Endpoint - Follow-up questions to recommendations
router.post('/chat', async (req, res) => {
  try {
    const { user_id, user_question, current_recommendations, current_suggestions, daily_nutrition } = req.body;

    if (!user_id || !user_question) {
      return res.status(400).json({ error: 'user_id and user_question are required' });
    }

    const user = await get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const quota = await consumeAiQuota(user_id);
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI günlük limit doldu (${quota.limit}). Yarın tekrar deneyin.`,
        limit: quota.limit,
        usedToday: quota.usage.request_count,
        remainingToday: 0
      });
    }

    const aiResponse = await getAIChatResponse(user_question, {
      current_recommendations,
      current_suggestions,
      daily_nutrition,
      user_profile: {
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        goal: user.goal,
        daily_calorie_goal: user.daily_calorie_goal
      }
    });

    if (aiResponse?.success === false) {
      return res.status(500).json({ error: aiResponse.error || 'Yanıt alınamadı' });
    }

    res.json({
      response: aiResponse.response,
      warning: '',
      usage: quota.usage,
      limit: quota.limit,
      remainingToday: Math.max(0, quota.limit - quota.usage.request_count)
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/usage/:userId', async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const usage = await getAiUsage(req.params.userId);
    res.json({
      limit: AI_DAILY_LIMIT,
      usedToday: usage.request_count || 0,
      remainingToday: Math.max(0, AI_DAILY_LIMIT - (usage.request_count || 0)),
      usageDate: usage.usage_date || getTodayString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
