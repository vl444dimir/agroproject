import backendClient from './backendClient';

/**
 * API для работы с культурами — Spring Boot бэкенд.
 */
export const culturesApi = {
  getAll: () => backendClient.get('/cultures'),
  getById: (id) => backendClient.get(`/cultures/${id}`),
  create: (data) => backendClient.post('/cultures', data),
  update: (id, data) => backendClient.put(`/cultures/${id}`, data),
  delete: (id) => backendClient.delete(`/cultures/${id}`),
};
