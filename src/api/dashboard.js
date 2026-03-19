import apiClient from './client';

export const dashboardApi = {
  getKPI: () => apiClient.get('/kpi').catch(() => ({ data: {} })),
  getTopFertilizers: () => apiClient.get('/topFertilizers').catch(() => ({ data: [] })),
  getTopPesticides: () => apiClient.get('/topPesticides').catch(() => ({ data: [] })),
  getMapDistricts: () => apiClient.get('/mapDistricts').catch(() => ({ data: [] })),
};
