const axios = require('axios');

const FOOD_AI_PROVIDER = String(process.env.FOOD_AI_PROVIDER || 'openrouter').toLowerCase();
const FOOD_AI_OPENROUTER_API_KEY = process.env.FOOD_AI_OPENROUTER_API_KEY;
const FOOD_AI_OPENROUTER_MODELS = (process.env.FOOD_AI_OPENROUTER_MODELS || 'google/gemma-4-26b-a4b-it:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const FOOD_AI_GROQ_API_KEY = process.env.FOOD_AI_GROQ_API_KEY;
const FOOD_AI_GROQ_MODELS = (process.env.FOOD_AI_GROQ_MODELS || 'llama-3.1-8b-instant')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const FOOD_AI_GEMINI_API_KEY = process.env.FOOD_AI_GEMINI_API_KEY;
const FOOD_AI_GEMINI_MODELS = (process.env.FOOD_AI_GEMINI_MODELS || 'gemini-2.0-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const ORIGIN = process.env.OPENROUTER_ORIGIN || 'http://localhost:3000';
const APP_NAME = process.env.OPENROUTER_APP_NAME || 'Diet Tracker App - Food Search';

const extractJsonPayload = (text) => {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '');

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
};

const buildPrompt = (query) => `Sen bir diyetisyen veri asistanisin. Sadece gecerli JSON don. Markdown veya aciklama yazma.

Kullanici gida aradi: "${query}".

Bu gidaya en yakin gercekci urun/icerik sonucunu ver.

JSON formati:
{
  "name": "string",
  "category": "string",
  "description": "string",
  "calories_per_100g": number,
  "protein_per_100g": number,
  "carbs_per_100g": number,
  "fat_per_100g": number,
  "confidence": "low|medium|high"
}

Kurallar:
- Isim Turkceye uygun ve gercek bir gida urunu olmali.
- Marka varsa isme ekle.
- Degerler gercekci olmali.
- Sadece JSON don.`;

const callOpenRouter = async (prompt) => {
  if (!FOOD_AI_OPENROUTER_API_KEY) {
    throw new Error('FOOD_AI_OPENROUTER_API_KEY not configured');
  }

  for (const model of FOOD_AI_OPENROUTER_MODELS) {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1200
      },
      {
        headers: {
          Authorization: `Bearer ${FOOD_AI_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': ORIGIN,
          'X-Title': APP_NAME
        },
        timeout: 20000
      }
    );

    const text = response?.data?.choices?.[0]?.message?.content;
    if (text) {
      return text;
    }
  }

  throw new Error('OpenRouter returned empty response');
};

const callGroq = async (prompt) => {
  if (!FOOD_AI_GROQ_API_KEY) {
    throw new Error('FOOD_AI_GROQ_API_KEY not configured');
  }

  for (const model of FOOD_AI_GROQ_MODELS) {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1200
      },
      {
        headers: {
          Authorization: `Bearer ${FOOD_AI_GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const text = response?.data?.choices?.[0]?.message?.content;
    if (text) {
      return text;
    }
  }

  throw new Error('Groq returned empty response');
};

const callGemini = async (prompt) => {
  if (!FOOD_AI_GEMINI_API_KEY) {
    throw new Error('FOOD_AI_GEMINI_API_KEY not configured');
  }

  for (const model of FOOD_AI_GEMINI_MODELS) {
    const requestPayload = (useJsonMode) => ({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200,
        ...(useJsonMode ? { responseMimeType: 'application/json' } : {})
      }
    });

    try {
      const response = await axios.post(
        `${GEMINI_API_URL}/${model}:generateContent?key=${FOOD_AI_GEMINI_API_KEY}`,
        requestPayload(true),
        { timeout: 20000 }
      );

      const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 400 && status !== 404) {
        throw error;
      }
    }

    const response = await axios.post(
      `${GEMINI_API_URL}/${model}:generateContent?key=${FOOD_AI_GEMINI_API_KEY}`,
      requestPayload(false),
      { timeout: 20000 }
    );

    const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return text;
    }
  }

  throw new Error('Gemini returned empty response');
};

const callProvider = async (prompt) => {
  const providers = [];
  
  // Build provider list based on config and availability
  if (FOOD_AI_PROVIDER === 'groq') {
    providers.push({ name: 'groq', fn: callGroq });
    providers.push({ name: 'openrouter', fn: callOpenRouter });
    providers.push({ name: 'gemini', fn: callGemini });
  } else if (FOOD_AI_PROVIDER === 'gemini') {
    providers.push({ name: 'gemini', fn: callGemini });
    providers.push({ name: 'openrouter', fn: callOpenRouter });
    providers.push({ name: 'groq', fn: callGroq });
  } else {
    // default to openrouter
    providers.push({ name: 'openrouter', fn: callOpenRouter });
    providers.push({ name: 'gemini', fn: callGemini });
    providers.push({ name: 'groq', fn: callGroq });
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.name} for AI food search...`);
      const result = await provider.fn(prompt);
      console.log(`✅ ${provider.name} succeeded`);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ ${provider.name} failed: ${error.message}`);
      // Continue to next provider
    }
  }

  throw lastError || new Error('All AI providers failed');
};

const getFoodSearchAIResult = async (query) => {
  if (!String(query || '').trim()) {
    return { success: false, error: 'query is required' };
  }

  try {
    const prompt = buildPrompt(query);
    const text = await callProvider(prompt);
    const parsed = extractJsonPayload(text);

    if (!parsed || !parsed.name) {
      console.error(`❌ Invalid AI response for "${query}":`, { parsed, text: text?.substring(0, 200) });
      return { success: false, error: 'AI response invalid' };
    }

    console.log(`✅ Food found via AI: ${parsed.name}`);
    return {
      success: true,
      food: {
        name: String(parsed.name).trim(),
        category: String(parsed.category || 'AI Üretilen').trim(),
        description: String(parsed.description || 'AI tarafindan olusturuldu').trim(),
        calories_per_100g: Math.round(Number(parsed.calories_per_100g) || 0),
        protein_per_100g: Number(parsed.protein_per_100g) || 0,
        carbs_per_100g: Number(parsed.carbs_per_100g) || 0,
        fat_per_100g: Number(parsed.fat_per_100g) || 0,
        confidence: String(parsed.confidence || 'low')
      }
    };
  } catch (error) {
    console.error(`⚠️ Real AI failed: ${error.message}`);
    console.log(`🤖 Using mock food data for "${query}"`);
    
    // Mock fallback for development - provides reasonable estimates
    const mockData = {
      'sushi': { name: 'Sushi', category: 'Yemek', description: 'Pirinç ve balık', calories: 127, protein: 5.4, carbs: 20.3, fat: 2.2, confidence: 'medium' },
      'pizza': { name: 'Pizza', category: 'Yemek', description: 'Standart pizza', calories: 265, protein: 11, carbs: 36, fat: 10, confidence: 'medium' },
      'hamburger': { name: 'Hamburger', category: 'Yemek', description: 'Hamburger', calories: 215, protein: 15, carbs: 16, fat: 11, confidence: 'medium' },
      'döner': { name: 'Döner', category: 'Yemek', description: 'Et döner', calories: 188, protein: 15, carbs: 15, fat: 9, confidence: 'medium' },
      'kebap': { name: 'Kebap', category: 'Yemek', description: 'Kuşbaşı kebap', calories: 168, protein: 26, carbs: 2, fat: 7, confidence: 'medium' },
      'biftek': { name: 'Biftek', category: 'Yemek', description: 'Pişmiş biftek', calories: 250, protein: 28, carbs: 0, fat: 14, confidence: 'medium' },
      'kola': { name: 'Kola', category: 'İçecek', description: 'Şekerli kola', calories: 42, protein: 0, carbs: 11, fat: 0, confidence: 'high' },
      'bira': { name: 'Bira', category: 'İçecek', description: 'Standart bira', calories: 43, protein: 0.3, carbs: 3.2, fat: 0, confidence: 'high' },
      'kahve': { name: 'Kahve', category: 'İçecek', description: 'Sade kahve', calories: 2, protein: 0.1, carbs: 0, fat: 0, confidence: 'high' },
      'ayran': { name: 'Ayran', category: 'İçecek', description: 'Türk ayranı', calories: 25, protein: 1.5, carbs: 3, fat: 1, confidence: 'high' },
      'pasta': { name: 'Pasta', category: 'Yemek', description: 'Krema soslu pasta', calories: 150, protein: 6, carbs: 20, fat: 5, confidence: 'medium' },
      'çorba': { name: 'Çorba', category: 'Yemek', description: 'Mercimek çorbası', calories: 45, protein: 2.5, carbs: 7, fat: 0.8, confidence: 'medium' },
      'pilav': { name: 'Pilav', category: 'Yemek', description: 'Pirinç pilav', calories: 150, protein: 4.5, carbs: 28, fat: 3, confidence: 'medium' },
      'omlet': { name: 'Omlet', category: 'Yemek', description: '2 yumurtalı omlet', calories: 154, protein: 13.6, carbs: 1.1, fat: 11, confidence: 'high' },
      'pancake': { name: 'Pancake', category: 'Yemek', description: 'Standart pancake', calories: 227, protein: 6, carbs: 42, fat: 5, confidence: 'medium' },
      'waffle': { name: 'Waffle', category: 'Yemek', description: 'Çikolatalı waffle', calories: 300, protein: 6, carbs: 45, fat: 12, confidence: 'medium' },
    };

    const queryLower = String(query).toLowerCase().trim();
    const match = Object.keys(mockData).find(key => queryLower.includes(key) || key.includes(queryLower));
    
    if (match) {
      const food = mockData[match];
      return {
        success: true,
        food: {
          name: food.name,
          category: food.category,
          description: food.description,
          calories_per_100g: food.calories,
          protein_per_100g: food.protein,
          carbs_per_100g: food.carbs,
          fat_per_100g: food.fat,
          confidence: food.confidence
        }
      };
    }

    return { success: false, error: 'Could not find or estimate food data' };
  }
};

module.exports = {
  getFoodSearchAIResult
};
