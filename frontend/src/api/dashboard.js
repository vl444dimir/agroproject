import backendClient from './backendClient';

export const dashboardApi = {
  getKPI: () => backendClient.get('/stats/dashboard-kpi').catch(() => ({ data: {} })),
  getTopFertilizers: () => backendClient.get('/stats/top-fertilizers').catch(() => ({ data: [] })),
  getTopPesticides: () => backendClient.get('/stats/top-pesticides').catch(() => ({ data: [] })),
  getMapDistricts: () => backendClient.get('/stats/map-districts').catch(() => ({ data: [] })),
};
