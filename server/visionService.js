const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const VISION_OPENROUTER_API_KEY = process.env.VISION_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
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

function getFallbackFoodEstimate(hintText = '') {
  const query = String(hintText || '').toLowerCase();

  const presets = [
    { match: ['muz', 'banana'], name: 'Muz', calories_per_100g: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    { match: ['elma', 'apple'], name: 'Elma', calories_per_100g: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    { match: ['tavuk'], name: 'Tavuk gogsu', calories_per_100g: 165, protein: 31, carbs: 0, fat: 3.6 },
    { match: ['pilav', 'rice'], name: 'Pirincli yemek', calories_per_100g: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { match: ['salata'], name: 'Karisik salata', calories_per_100g: 45, protein: 1.5, carbs: 7, fat: 1.2 }
  ];

  const found = presets.find((preset) => preset.match.some((needle) => query.includes(needle)));
  return found || { name: 'Karisik yemek', calories_per_100g: 120, protein: 5, carbs: 12, fat: 4 };
}

async function callOpenRouterVision(prompt, imageBase64, mimeType) {
  if (!VISION_OPENROUTER_API_KEY) {
    throw new Error('VISION_OPENROUTER_API_KEY or OPENROUTER_API_KEY not configured');
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
            Authorization: `Bearer ${VISION_OPENROUTER_API_KEY}`,
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
    const text = await callOpenRouterVision(prompt, imageBase64, mimeType);
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
    const fallbackFood = getFallbackFoodEstimate(hintText);
    const estimatedGrams = 120;
    const totalCalories = Math.round((fallbackFood.calories_per_100g * estimatedGrams) / 100);

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
        confidence: 'low',
        notes: 'Gorsel AI su anda yogun. Tahmini sonuc gosterildi, ipucu yazarsan daha dogru olur.'
      }
    };
  }
}

module.exports = {
  analyzeFoodImage
};
