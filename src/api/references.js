import apiClient from './client';

export const referencesApi = {
  getFertilizers: () => apiClient.get('/fertilizersRef').catch(() => ({ data: [] })),
  getPesticides: () => apiClient.get('/pesticidesRef').catch(() => ({ data: [] })),
};
