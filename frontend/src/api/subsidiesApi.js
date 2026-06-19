import backendClient from './backendClient';

export const subsidiesApi = {
  getAll: () => backendClient.get('/subsidies'),
  getById: (id) => backendClient.get(`/subsidies/${id}`),
  create: (data) => backendClient.post('/subsidies', data),
  getFlatStats: () => backendClient.get('/stats/subsidies-flat'),
  exportFlatExcel: () => backendClient.get('/stats/subsidies-flat/export', { responseType: 'blob' }),
  exportGroupedExcel: () => backendClient.get('/stats/grouped/export', { responseType: 'blob' }),
};
