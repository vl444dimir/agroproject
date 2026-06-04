import backendClient from './backendClient';

export const referencesApi = {
  // На бэкенде пока все препараты лежат в /products, можно сделать фильтрацию по категории позже
  getFertilizers: () => backendClient.get('/products?categoryName=Удобрения').catch(() => ({ data: [] })),
  getPesticides: () => backendClient.get('/products?categoryName=Пестициды').catch(() => ({ data: [] })),
  getCultures: () => backendClient.get('/cultures').catch(() => ({ data: [] })),
  getDistricts: () => backendClient.get('/districts').catch(() => ({ data: [] })),
};
