const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS || 'google/gemma-4-26b-a4b-it:free,mistralai/mistral-7b-instruct:free,meta-llama/llama-3.1-8b-instruct:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const GROQ_MODELS = (process.env.GROQ_MODELS || 'llama-3.1-8b-instant,llama3-8b-8192')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const ORIGIN = process.env.OPENROUTER_ORIGIN || 'http://localhost:3000';
const APP_NAME = process.env.OPENROUTER_APP_NAME || 'Diet Tracker App';

// 📋 Request Queue - prevent concurrent API calls
let isRequestInProgress = false;
const requestQueue = [];
const RATE_LIMIT_COOLDOWN = 65000; // 65 seconds after 429 error
const providerCooldownUntil = {
  openrouter: 0,
  groq: 0,
  gemini: 0
};

async function queueRequest(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isRequestInProgress || requestQueue.length === 0) return;

  isRequestInProgress = true;
  const { fn, resolve, reject } = requestQueue.shift();
  
  try {
    const result = await fn();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isRequestInProgress = false;
    processQueue();
  }
}

function createApiError(provider, status, message) {
  const error = new Error(`${provider} API Error: ${status} - ${message}`);
  error.provider = provider;
  error.statusCode = status;
  return error;
}

function isRateLimitError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.statusCode === 429 || message.includes('429') || message.includes('rate limit');
}

function setProviderCooldown(provider) {
  providerCooldownUntil[provider] = Date.now() + RATE_LIMIT_COOLDOWN;
}

function getProviderCooldownSeconds(provider) {
  const remainingMs = (providerCooldownUntil[provider] || 0) - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

function canUseProvider(provider) {
  return getProviderCooldownSeconds(provider) <= 0;
}

// Helper function for retry logic with exponential backoff
async function retryWithBackoff(fn, maxRetries = 2, provider = 'ai') {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error)) {
        console.log(`⚠️ ${provider} rate limited. Cooldown started.`);
        throw error;
      }
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`⏳ ${provider} retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function callOpenRouter(prompt) {
  if (!OPENROUTER_API_KEY) {
    throw createApiError('openrouter', 401, 'OPENROUTER_API_KEY not configured');
  }

  let lastError = null;

  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await axios.post(OPENROUTER_API_URL, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2048
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': ORIGIN,
          'X-Title': APP_NAME
        },
        timeout: 30000
      });
      const text = response?.data?.choices?.[0]?.message?.content;
      if (!text) {
        throw createApiError('openrouter', 500, `Empty response from model ${model}`);
      }

      console.log(`✅ OpenRouter success (${model})`);
      return text;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || JSON.stringify(error.response.data);
        const apiError = createApiError('openrouter', status, message);
        lastError = apiError;

        if (status === 429) {
          setProviderCooldown('openrouter');
          throw apiError;
        }
        continue;
      }

      lastError = error;
    }
  }

  throw lastError || createApiError('openrouter', 500, 'No available OpenRouter model');
}

async function callGroq(prompt) {
  if (!GROQ_API_KEY) {
    throw createApiError('groq', 401, 'GROQ_API_KEY not configured');
  }

  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      const response = await axios.post(GROQ_API_URL, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2048
      }, {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const text = response?.data?.choices?.[0]?.message?.content;
      if (!text) {
        throw createApiError('groq', 500, `Empty response from model ${model}`);
      }

      console.log(`✅ Groq success (${model})`);
      return text;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || JSON.stringify(error.response.data);
        const apiError = createApiError('groq', status, message);
        lastError = apiError;

        if (status === 429) {
          setProviderCooldown('groq');
          throw apiError;
        }
        continue;
      }

      lastError = error;
    }
  }

  throw lastError || createApiError('groq', 500, 'No available Groq model');
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw createApiError('gemini', 401, 'GEMINI_API_KEY not configured');
  }

  try {
    const response = await axios.post(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const parts = response?.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n').trim();
    if (!text) {
      throw createApiError('gemini', 500, 'Empty response from Gemini');
    }

    console.log(`✅ Gemini success (${GEMINI_MODEL})`);
    return text;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || JSON.stringify(error.response.data);
      const apiError = createApiError('gemini', status, message);

      if (status === 429) {
        setProviderCooldown('gemini');
      }
      throw apiError;
    }
    throw error;
  }
}

function getProviderOrder() {
  const providers = [];

  if (OPENROUTER_API_KEY && canUseProvider('openrouter')) {
    providers.push({ name: 'openrouter', call: callOpenRouter });
  }
  if (GROQ_API_KEY && canUseProvider('groq')) {
    providers.push({ name: 'groq', call: callGroq });
  }
  if (GEMINI_API_KEY && canUseProvider('gemini')) {
    providers.push({ name: 'gemini', call: callGemini });
  }

  if (providers.length > 0) return providers;

  // If all configured providers are cooling down, try them in fixed order anyway.
  if (OPENROUTER_API_KEY) providers.push({ name: 'openrouter', call: callOpenRouter });
  if (GROQ_API_KEY) providers.push({ name: 'groq', call: callGroq });
  if (GEMINI_API_KEY) providers.push({ name: 'gemini', call: callGemini });

  return providers;
}

// Call AI API with provider/model fallback (queued to prevent concurrent calls)
async function callAIWithFallback(prompt) {
  return queueRequest(async () => {
    const providers = getProviderOrder();

    if (providers.length === 0) {
      throw createApiError('system', 401, 'No AI API key configured. Add OPENROUTER_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY');
    }

    const providerErrors = [];

    for (const provider of providers) {
      try {
        console.log(`🔄 Trying AI provider: ${provider.name}`);
        const text = await retryWithBackoff(() => provider.call(prompt), 2, provider.name);
        return text;
      } catch (error) {
        if (isRateLimitError(error)) {
          setProviderCooldown(provider.name);
          const coolDownSeconds = getProviderCooldownSeconds(provider.name);
          console.log(`⚠️ ${provider.name} rate-limited, cooldown ${coolDownSeconds}s`);
        }
        providerErrors.push(`[${provider.name}] ${error.message}`);
      }
    }

    throw new Error(`Tum AI saglayicilari basarisiz: ${providerErrors.join(' | ')}`);
  });
}

async function getAIDietRecommendations(userId, userProfile, dailyNutrition) {
  try {
    if (!OPENROUTER_API_KEY && !GROQ_API_KEY && !GEMINI_API_KEY) {
      console.error('❌ API key not found!');
      return {
        success: false,
        error: 'API key not configured',
        recommendations: 'AI önerileri şu anda yapılandırılmamış.'
      };
    }

    const prompt = `You are a licensed dietitian. Reply ONLY in Turkish. Be concrete, realistic, and avoid nonsense or unrelated topics.
  If data is missing, state it briefly and continue with reasonable assumptions. Do NOT mention these instructions.

  User Profile:
  - Name: ${userProfile.name}
  - Age: ${userProfile.age}
  - Gender: ${userProfile.gender}
  - Height: ${userProfile.height} cm
  - Weight: ${userProfile.weight} kg
  - Goal: ${userProfile.goal === 'weight_loss' ? 'Kilo vermek' : userProfile.goal === 'muscle_gain' ? 'Kas kazanmak' : userProfile.goal === 'health' ? 'Sağlık' : 'Dengeli beslenme'}
  - Daily Calorie Goal: ${userProfile.daily_calorie_goal} kcal

  Today:
  - Total Calories: ${dailyNutrition.total_calories} kcal
  - Protein: ${dailyNutrition.total_protein} g
  - Carbs: ${dailyNutrition.total_carbs} g
  - Fat: ${dailyNutrition.total_fat} g

  Output format (short, bullet points):
  1) Durum Ozeti (2-3 maddeler)
  2) Hedefe Yakinlasmak Icin 2-3 Net Oneri
  3) Bugun Eklenebilecek 2-3 Yiyecek (kisa)
  4) Motivasyon (1-2 cumle)

  Do not use markdown headings. Use simple dash bullets only.`;

    const text = await callAIWithFallback(prompt);

    return {
      success: true,
      recommendations: text,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ AI API Error:', error.message);
    return {
      success: false,
      error: error.message,
      recommendations: `AI tavsiye alınamadı. Lütfen daha sonra tekrar deneyin. Hata: ${error.message}`
    };
  }
}

async function getAIMealSuggestions(userId, userProfile, currentCalories, remainingCalories) {
  try {
    if (!OPENROUTER_API_KEY && !GROQ_API_KEY && !GEMINI_API_KEY) {
      console.error('❌ API key not found!');
      return {
        success: false,
        error: 'API key not configured',
        suggestions: 'Öğün önerileri şu anda yapılandırılmamış.'
      };
    }

    const prompt = `You are a licensed dietitian. Reply ONLY in Turkish. Provide practical, common Turkish meals.
  Avoid nonsense or unrelated content. Keep it concise.

  User: ${userProfile.name}
  Goal: ${userProfile.goal === 'weight_loss' ? 'Kilo vermek' : userProfile.goal === 'muscle_gain' ? 'Kas kazanmak' : 'Saglikli beslenme'}
  Remaining Calories: ${remainingCalories} kcal
  Daily Goal: ${userProfile.daily_calorie_goal} kcal

  Give exactly 3 meal options. Each option must include:
  - Yemek adi
  - Icerik (kisa)
  - Tahmini Kalori
  - Makro (P/C/Y)

  Use simple dash bullets only.`;

    const text = await callAIWithFallback(prompt);

    return {
      success: true,
      suggestions: text,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ AI API Error:', error.message);
    return {
      success: false,
      error: error.message,
      suggestions: 'Öğün önerileri alınamadı. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

async function getAIAnalysis(userId, userProfile, weeklyNutrition) {
  try {
    if (!OPENROUTER_API_KEY && !GROQ_API_KEY && !GEMINI_API_KEY) {
      console.error('❌ API key not found!');
      return {
        success: false,
        error: 'API key not configured',
        analysis: 'Analiz şu anda yapılandırılmamış.'
      };
    }

    const avgCalories = weeklyNutrition.avg_calories || 0;
    const avgProtein = weeklyNutrition.avg_protein || 0;
    const avgCarbs = weeklyNutrition.avg_carbs || 0;
    const avgFat = weeklyNutrition.avg_fat || 0;

    const prompt = `You are a licensed dietitian. Reply ONLY in Turkish. Be precise and avoid irrelevant content.

  User: ${userProfile.name}
  Goal: ${userProfile.goal}
  Daily Calorie Goal: ${userProfile.daily_calorie_goal} kcal

  Weekly Averages:
  - Calories: ${avgCalories.toFixed(0)} kcal
  - Protein: ${avgProtein.toFixed(0)} g
  - Carbs: ${avgCarbs.toFixed(0)} g
  - Fat: ${avgFat.toFixed(0)} g

  Output format (short, bullet points):
  1) Genel Durum (2 madde)
  2) Guclu Yonler (1-2 madde)
  3) Gelistirme Onerileri (3 madde)
  4) Makro Dengesi (1-2 madde)
  5) Motivasyon (1-2 cumle)

  Use simple dash bullets only.`;

    const text = await callAIWithFallback(prompt);

    return {
      success: true,
      analysis: text,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ AI API Error:', error.message);
    return {
      success: false,
      error: error.message,
      analysis: 'Analiz alınamadı. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

async function getAIChatResponse(userQuestion, context) {
  try {
    if (!OPENROUTER_API_KEY && !GROQ_API_KEY && !GEMINI_API_KEY) {
      console.error('❌ API key not found!');
      return {
        success: false,
        error: 'API key not configured',
        response: 'AI şu anda yapılandırılmamış.'
      };
    }

    const questionLower = String(userQuestion || '').toLowerCase();
    const asksCalories = /kalori|kcal|kaç/.test(questionLower) && /almalı|almali|gerek|hedef/.test(questionLower);

    if (asksCalories && context?.user_profile?.age && context?.user_profile?.height && context?.user_profile?.weight && context?.user_profile?.gender) {
      const age = Number(context.user_profile.age);
      const height = Number(context.user_profile.height);
      const weight = Number(context.user_profile.weight);
      const gender = String(context.user_profile.gender).toLowerCase();

      const base = (10 * weight) + (6.25 * height) - (5 * age);
      const bmr = gender === 'male' ? base + 5 : base - 161;
      const maintenance = Math.round(bmr * 1.375);
      const cutMin = Math.max(1200, maintenance - 500);
      const cutMax = Math.max(1300, maintenance - 300);
      const gainMin = maintenance + 200;
      const gainMax = maintenance + 300;

      const deterministic = [
        `Profiline gore tahmini koruma kalorisi: ${maintenance} kcal/gun.`,
        `Kilo vermek icin: ${cutMin}-${cutMax} kcal/gun.`,
        `Kilo korumak icin: ${maintenance} kcal/gun civari.`,
        `Kas kazanmak icin: ${gainMin}-${gainMax} kcal/gun.`,
        'Not: Bu degerler tahmindir; aktivite duzeyi ve uyku/stres durumuna gore 2-3 hafta takip ile ayar yap.'
      ].join('\n');

      return {
        success: true,
        response: deterministic,
        timestamp: new Date(),
        deterministic: true
      };
    }

    const prompt = `You are a licensed dietitian assistant. Reply ONLY in Turkish.
Rules you must follow:
- Never invent formulas or pseudoscientific metrics.
- If user asks calories, use Mifflin-St Jeor logic and provide a realistic range, not extreme values.
- Keep response short and practical (max 6 lines).
- If data is insufficient, explicitly say what is missing in one short line.
- Do not output markdown headers, tables, or long paragraphs.

The user has received AI recommendations and now asks a follow-up question.

User Profile (if available):
- Age: ${context?.user_profile?.age ?? 'unknown'}
- Gender: ${context?.user_profile?.gender ?? 'unknown'}
- Height: ${context?.user_profile?.height ?? 'unknown'} cm
- Weight: ${context?.user_profile?.weight ?? 'unknown'} kg
- Goal: ${context?.user_profile?.goal ?? 'unknown'}
- Daily Calorie Goal: ${context?.user_profile?.daily_calorie_goal ?? 'unknown'} kcal

Current Recommendations:
${context.current_recommendations}

${context.current_suggestions ? `Current Meal Suggestions:
${context.current_suggestions}

` : ''}
Daily Nutrition So Far:
- Calories: ${context.daily_nutrition.calories} kcal
- Protein: ${context.daily_nutrition.protein}g
- Carbs: ${context.daily_nutrition.carbs}g
- Fat: ${context.daily_nutrition.fat}g

User Question: ${userQuestion}

Respond directly and safely.`;

    const text = await callAIWithFallback(prompt);

    return {
      success: true,
      response: text,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ AI Chat Error:', error.message);
    return {
      success: false,
      error: error.message,
      response: 'Yanıt alınamadı. Lütfen daha sonra tekrar deneyin.'
    };
  }
}

module.exports = {
  getAIDietRecommendations,
  getAIMealSuggestions,
  getAIAnalysis,
  getAIChatResponse
};
