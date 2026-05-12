import { GoogleGenAI } from '@google/genai';

const GEMINI_INVENTORY_MODEL =
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

export const buildFallbackInventoryExplanation = (data = {}) => {
  const demandCity = data.demandCityLabel || data.demandCity || 'This city';
  const productTitle = data.productTitle || 'this product';
  const destinationWarehouse = data.destinationWarehouseName || data.toWarehouseName || 'the destination warehouse';
  const sourceWarehouse = data.sourceWarehouseName || data.fromWarehouseName || 'the source warehouse';
  const quantity = Number(data.suggestedQuantity || 0);
  const pressure = data.pressureLevel || 'stock';

  return `${demandCity} is showing ${pressure} demand for ${productTitle}, but local stock is low. ${sourceWarehouse} has enough available stock. Transfer ${quantity} unit${quantity === 1 ? '' : 's'} to ${destinationWarehouse} to reduce stock pressure.`;
};

export const generateInventoryRecommendationExplanation = async (recommendationPayload = {}) => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = [
    'You are an inventory assistant for Athar, a Palestinian-inspired accessories e-commerce brand.',
    'Write concise admin explanations for stock transfer recommendations.',
    'Use only the provided facts. Do not invent numbers. Keep the explanation under 70 words.',
    'Output plain text only. No markdown.',
    '',
    `Product: ${recommendationPayload.productTitle || ''}`,
    `Category: ${recommendationPayload.productCategory || ''}`,
    `Demand city: ${recommendationPayload.demandCityLabel || ''}`,
    `City demand score: ${Number(recommendationPayload.cityDemandScore || 0)}`,
    `Destination warehouse: ${recommendationPayload.destinationWarehouseName || ''}`,
    `Destination stock: ${Number(recommendationPayload.destinationStock || 0)}`,
    `Source warehouse: ${recommendationPayload.sourceWarehouseName || ''}`,
    `Source stock: ${Number(recommendationPayload.sourceStock || 0)}`,
    `Suggested transfer: ${Number(recommendationPayload.suggestedQuantity || 0)} units`,
    `Pressure: ${recommendationPayload.pressureLevel || ''}`,
    `Confidence: ${Number(recommendationPayload.confidence || 0)}%`,
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_INVENTORY_MODEL,
      contents: prompt,
      config: {
        temperature: 0.25,
      },
    });
    const text = getResponseText(response);
    return text || null;
  } catch (error) {
    console.warn('[Athar inventory recommendations] Gemini explanation failed:', error.message);
    return null;
  }
};

export const getInventoryGeminiModel = () => GEMINI_INVENTORY_MODEL;
