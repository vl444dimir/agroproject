import backendClient from './backendClient';

export const livestockApi = {
  getAll: (params) => backendClient.get('/livestock', { params }),
  create: (data) => backendClient.post('/livestock', data),
  update: (id, data) => backendClient.put(`/livestock/${id}`, data),
  delete: (id) => backendClient.delete(`/livestock/${id}`),
};
