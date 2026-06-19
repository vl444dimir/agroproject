import backendClient from './backendClient';

export const reportsApi = {
  getReports: () => backendClient.get('/subsidies').catch(() => ({ data: [] })),
  getFlatReports: () => backendClient.get('/stats/subsidies-flat').catch(() => ({ data: [] })),
  getPaginatedReports: (params) => backendClient.get('/stats/subsidies-paginated', { params }).catch(() => ({ data: { content: [], totalElements: 0, totalPages: 0 } })),
  getReportsSummary: (params) => backendClient.get('/stats/subsidies-summary', { params }).catch(() => ({ data: { totalArea: 0, totalAmount: 0, warningsCount: 0, chartData: [] } })),
  getReportById: (id) => backendClient.get(`/subsidies/${id}`),
  createReport: (data) => backendClient.post('/subsidies', data),
  updateReport: (id, data) => backendClient.put(`/subsidies/${id}`, data),
  updateStatus: (id, status) => backendClient.put(`/subsidies/${id}/status?status=${status}`),
  deleteReport: (id) => backendClient.delete(`/subsidies/${id}`),
};

