import apiClient from './client';

export const reportsApi = {
  getReports: () => apiClient.get('/reports').catch(() => ({ data: [] })),
  getReportById: (id) => apiClient.get(`/reports/${id}`),
  createReport: (data) => apiClient.post('/reports', data),
  updateReport: (id, data) => apiClient.put(`/reports/${id}`, data),
  deleteReport: (id) => apiClient.delete(`/reports/${id}`),
};
