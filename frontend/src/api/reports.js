import backendClient from './backendClient';

export const reportsApi = {
  getReports: () => backendClient.get('/subsidies').catch(() => ({ data: [] })),
  getFlatReports: () => backendClient.get('/stats/subsidies-flat').catch(() => ({ data: [] })),
  getReportById: (id) => backendClient.get(`/subsidies/${id}`),
  createReport: (data) => backendClient.post('/subsidies', data),
  updateReport: (id, data) => backendClient.put(`/subsidies/${id}`, data),
  deleteReport: (id) => backendClient.delete(`/subsidies/${id}`),
};

