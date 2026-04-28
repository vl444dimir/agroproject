import backendClient from './backendClient';

/**
 * API для работы с производителями — Spring Boot бэкенд.
 */
export const manufacturersApi = {
  getAll: () => backendClient.get('/manufacturers'),
  getById: (id) => backendClient.get(`/manufacturers/${id}`),
  create: (data) => backendClient.post('/manufacturers', data),
  update: (id, data) => backendClient.put(`/manufacturers/${id}`, data),
  delete: (id) => backendClient.delete(`/manufacturers/${id}`),
};
