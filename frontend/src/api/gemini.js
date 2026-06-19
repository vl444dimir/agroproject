import backendClient from './backendClient';

export const askGemini = async (prompt, systemInstruction = '') => {
  const response = await backendClient.post('/ai/ask', {
    prompt,
    systemInstruction
  });
  
  const text = response.data?.text;
  if (!text) {
    throw new Error('Получен пустой ответ от ИИ-модели.');
  }
  return text;
};

export const parseJsonFromText = (text) => {
  try {
    // Try to extract json block from ```json { ... } ``` or ``` { ... } ```
    const regex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = text.match(regex);
    const jsonString = match ? match[1] : text;
    return JSON.parse(jsonString.trim());
  } catch (e) {
    console.error("Failed to parse JSON from text:", text, e);
    throw new Error("Не удалось разобрать JSON-ответ от ИИ-модели.");
  }
};
