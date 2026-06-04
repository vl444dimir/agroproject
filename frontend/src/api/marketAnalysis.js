import backendClient from './backendClient';

/**
 * API для получения аналитики рынка сбыта (ЭСФ и Таможенные декларации).
 */
export const marketAnalysisApi = {
  /** Получить сравнительную аналитику продаж и импорта по препаратам */
  getProductsAnalysis: () => backendClient.get('/market-analysis/products'),

  /** Получить цепочку поставок (движения) продукта по контрагентам */
  getProductSupplyChain: (productId) => backendClient.get(`/market-analysis/products/${productId}/supply-chain`),
};
