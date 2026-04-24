const axios = require('axios');
const { get } = require('./database');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_GEMINI_API_KEY = process.env.VISION_GEMINI_API_KEY;
const VISION_OPENROUTER_API_KEY = process.env.VISION_OPENROUTER_API_KEY;
const VISION_ALLOW_SHARED_KEYS = String(process.env.VISION_ALLOW_SHARED_KEYS || 'false').toLowerCase() === 'true';
const SHARED_GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SHARED_OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const GEMINI_VISION_MODELS = (process.env.GEMINI_VISION_MODELS || 'gemini-2.0-flash,gemini-2.0-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const OPENROUTER_VISION_MODELS = (process.env.OPENROUTER_VISION_MODELS || 'google/gemini-2.0-flash-exp:free,meta-llama/llama-3.2-11b-vision-instruct:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const ORIGIN = process.env.OPENROUTER_ORIGIN || 'http://localhost:3000';
const APP_NAME = process.env.OPENROUTER_APP_NAME || 'Diet Tracker App Vision';

function extractJsonPayload(text) {
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
}

async function getFallbackFoodEstimate(hintText = '') {
  const query = String(hintText || '').toLowerCase();

  const normalizedHint = String(hintText || '').trim();
  if (normalizedHint) {
    try {
      const exact = await get(
        `SELECT name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM food_database
         WHERE LOWER(name) = LOWER(?)
         LIMIT 1`,
        [normalizedHint]
      );

      if (exact) {
        return {
          name: exact.name,
          calories_per_100g: Math.max(0, Number(exact.calories_per_100g) || 0),
          protein: Number(exact.protein_per_100g) || 0,
          carbs: Number(exact.carbs_per_100g) || 0,
          fat: Number(exact.fat_per_100g) || 0,
          source: 'db'
        };
      }

      const partial = await get(
        `SELECT name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM food_database
         WHERE LOWER(name) LIKE LOWER(?)
         ORDER BY LENGTH(name) ASC
         LIMIT 1`,
        [`%${normalizedHint}%`]
      );

      if (partial) {
        return {
          name: partial.name,
          calories_per_100g: Math.max(0, Number(partial.calories_per_100g) || 0),
          protein: Number(partial.protein_per_100g) || 0,
          carbs: Number(partial.carbs_per_100g) || 0,
          fat: Number(partial.fat_per_100g) || 0,
          source: 'db'
        };
      }
    } catch (error) {
      // If DB lookup fails, continue with static fallback presets.
    }
  }

  const presets = [
    { match: ['muz', 'banana'], name: 'Muz', calories_per_100g: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    { match: ['elma', 'apple'], name: 'Elma', calories_per_100g: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    { match: ['tavuk'], name: 'Tavuk gogsu', calories_per_100g: 165, protein: 31, carbs: 0, fat: 3.6 },
    { match: ['pilav', 'rice'], name: 'Pirincli yemek', calories_per_100g: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { match: ['salata'], name: 'Karisik salata', calories_per_100g: 45, protein: 1.5, carbs: 7, fat: 1.2 }
  ];

  const found = presets.find((preset) => preset.match.some((needle) => query.includes(needle)));
  if (found) {
    return { ...found, source: 'preset' };
  }

  return { name: 'Karisik yemek', calories_per_100g: 120, protein: 5, carbs: 12, fat: 4, source: 'generic' };
}

function getVisionGeminiKey() {
  if (VISION_GEMINI_API_KEY) return VISION_GEMINI_API_KEY;
  if (VISION_ALLOW_SHARED_KEYS) return SHARED_GEMINI_API_KEY;
  return null;
}

function getVisionOpenRouterKey() {
  if (VISION_OPENROUTER_API_KEY) return VISION_OPENROUTER_API_KEY;
  if (VISION_ALLOW_SHARED_KEYS) return SHARED_OPENROUTER_API_KEY;
  return null;
}

async function callGeminiVision(prompt, imageBase64, mimeType) {
  const apiKey = getVisionGeminiKey();
  if (!apiKey) {
    throw new Error('VISION_GEMINI_API_KEY not configured');
  }

  let lastError = null;

  for (const model of GEMINI_VISION_MODELS) {
    try {
      const response = await axios.post(
        `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const parts = response?.data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p?.text || '').join('\n').trim();
      if (!text) {
        throw new Error(`Empty response from model ${model}`);
      }

      return text;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 400 || status === 404 || status === 429) {
          lastError = new Error(`[${model}] ${error.response.data?.error?.message || 'Gemini vision unavailable'}`);
          continue;
        }
      }
      lastError = error;
    }
  }

  throw lastError || new Error('No available Gemini vision model');
}

async function callOpenRouterVision(prompt, imageBase64, mimeType) {
  const apiKey = getVisionOpenRouterKey();
  if (!apiKey) {
    throw new Error('VISION_OPENROUTER_API_KEY not configured');
  }

  let lastError = null;

  for (const model of OPENROUTER_VISION_MODELS) {
    try {
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 900
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': ORIGIN,
            'X-Title': APP_NAME
          },
          timeout: 30000
        }
      );

      const content = response?.data?.choices?.[0]?.message?.content;
      const text = Array.isArray(content)
        ? content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n').trim()
        : String(content || '').trim();

      if (!text) {
        throw new Error(`Empty response from model ${model}`);
      }

      return text;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        // Skip unavailable models and continue trying other vision models.
        if (status === 400 || status === 404 || status === 429) {
          lastError = new Error(`[${model}] ${error.response.data?.error?.message || 'Vision model unavailable'}`);
          continue;
        }
      }

      lastError = error;
    }
  }

  throw lastError || new Error('No available OpenRouter vision model');
}

async function analyzeFoodImage(imageBase64, mimeType, hintText = '') {
  const prompt = `You are a food image nutrition assistant. Reply only valid JSON.

Estimate food and nutrition from image. Use user hint when useful.
Hint: "${hintText || 'none'}"

Return exactly:
{
  "food_name": "string",
  "estimated_grams": number,
  "calories_per_100g": number,
  "total_calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidence": "low|medium|high",
  "notes": "string"
}`;

  try {
    let text = '';
    try {
      text = await callGeminiVision(prompt, imageBase64, mimeType);
    } catch (geminiError) {
      text = await callOpenRouterVision(prompt, imageBase64, mimeType);
    }

    const parsed = extractJsonPayload(text);

    if (!parsed || !parsed.food_name) {
      throw new Error('Could not parse vision JSON response');
    }

    const estimatedGrams = Math.max(1, Math.round(Number(parsed.estimated_grams) || 100));
    const caloriesPer100g = Math.max(0, Math.round(Number(parsed.calories_per_100g) || 120));
    const totalCalories = Math.max(0, Math.round(Number(parsed.total_calories) || (estimatedGrams * caloriesPer100g) / 100));

    return {
      success: true,
      estimate: {
        food_name: String(parsed.food_name).trim(),
        estimated_grams: estimatedGrams,
        calories_per_100g: caloriesPer100g,
        total_calories: totalCalories,
        protein: Number(parsed.protein) || 0,
        carbs: Number(parsed.carbs) || 0,
        fat: Number(parsed.fat) || 0,
        confidence: String(parsed.confidence || 'medium'),
        notes: String(parsed.notes || '').trim()
      }
    };
  } catch (error) {
    const fallbackFood = await getFallbackFoodEstimate(hintText);
    const estimatedGrams = 120;
    const totalCalories = Math.round((fallbackFood.calories_per_100g * estimatedGrams) / 100);
    const fallbackNotes = fallbackFood.source === 'db'
      ? 'Gorsel AI su anda yogun. Ipucuna gore veritabanindan tahmini sonuc gosterildi.'
      : 'Gorsel AI su anda yogun. Tahmini sonuc gosterildi, ipucu yazarsan daha dogru olur.';

    return {
      success: true,
      estimate: {
        food_name: fallbackFood.name,
        estimated_grams: estimatedGrams,
        calories_per_100g: fallbackFood.calories_per_100g,
        total_calories: totalCalories,
        protein: fallbackFood.protein,
        carbs: fallbackFood.carbs,
        fat: fallbackFood.fat,
        confidence: fallbackFood.source === 'db' ? 'medium' : 'low',
        notes: fallbackNotes
      }
    };
  }
}

module.exports = {
  analyzeFoodImage
};
