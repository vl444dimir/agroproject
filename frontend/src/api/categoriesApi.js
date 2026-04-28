import backendClient from './backendClient';

/**
 * API для работы с категориями препаратов — Spring Boot бэкенд.
 */
export const categoriesApi = {
  getAll: () => backendClient.get('/categories'),
  getById: (id) => backendClient.get(`/categories/${id}`),
  create: (data) => backendClient.post('/categories', data),
  update: (id, data) => backendClient.put(`/categories/${id}`, data),
  delete: (id) => backendClient.delete(`/categories/${id}`),
};
