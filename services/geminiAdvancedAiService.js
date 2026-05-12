import { GoogleGenAI } from '@google/genai';

const GEMINI_ADVANCED_MODEL =
  process.env.GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite';

const getResponseText = (response) =>
  String(
    response?.text ||
      response?.candidates
        ?.flatMap((candidate) => candidate?.content?.parts ?? [])
        ?.map((part) => part?.text ?? '')
        ?.join('\n') ||
      '',
  ).trim();

const getGeminiClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
};

export const generateBusinessSummary = async (context = {}) => {
  const ai = getGeminiClient();

  if (!ai) {
    return null;
  }

  const prompt = [
    'You are an admin business analyst for Athar, a Palestinian-inspired accessories e-commerce brand.',
    'Write a concise dashboard summary using only the provided metrics.',
    'Highlight demand trends, city activity, inventory risks, and marketing opportunities.',
    'Do not invent data. Keep it under 120 words. Plain text only.',
    '',
    JSON.stringify(context),
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_ADVANCED_MODEL,
      contents: prompt,
      config: { temperature: 0.3 },
    });
    return getResponseText(response) || null;
  } catch (error) {
    console.warn('[Athar Advanced AI] Business summary Gemini failed:', error.message);
    return null;
  }
};

const normalizeCampaign = (campaign = {}, index = 0) => ({
  title: String(campaign.title || `Athar Campaign ${index + 1}`).trim(),
  target: String(campaign.target || campaign.audience || 'Athar customers').trim(),
  featuredItems: String(campaign.featuredItems || campaign.featured || campaign.product || 'Athar accessories').trim(),
  message: String(campaign.message || '').trim(),
  cta: String(campaign.cta || 'Shop Athar').trim(),
  reason: String(campaign.reason || '').trim(),
});

const parseCampaigns = (text = '') => {
  const cleaned = String(text).replace(/^```(?:json)?|```$/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    const campaigns = Array.isArray(parsed) ? parsed : parsed?.campaigns;
    return Array.isArray(campaigns) ? campaigns.slice(0, 3).map(normalizeCampaign) : null;
  } catch (_error) {
    return null;
  }
};

export const generateCampaignSuggestions = async (context = {}) => {
  const ai = getGeminiClient();

  if (!ai) {
    return null;
  }

  const prompt = [
    'Create 3 short marketing campaign ideas for Athar based only on the provided data.',
    'Each campaign must include title, target city/audience, featured product/category, short message, CTA, and reason.',
    'Keep it premium, culturally rooted, and suitable for a Palestinian-inspired accessories brand.',
    'Do not invent metrics. Return JSON only as {"campaigns":[...]} with max 3 campaigns.',
    '',
    JSON.stringify(context),
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_ADVANCED_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.45,
      },
    });
    return parseCampaigns(getResponseText(response));
  } catch (error) {
    console.warn('[Athar Advanced AI] Campaign Gemini failed:', error.message);
    return null;
  }
};

export const getAdvancedAiModel = () => GEMINI_ADVANCED_MODEL;
