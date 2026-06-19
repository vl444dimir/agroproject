import backendClient from './backendClient';

/**
 * API для работы с действующими веществами — Spring Boot бэкенд.
 */
export const ingredientsApi = {
  getAll: () => backendClient.get('/ingredients'),
  getById: (id) => backendClient.get(`/ingredients/${id}`),
  create: (data) => backendClient.post('/ingredients', data),
  update: (id, data) => backendClient.put(`/ingredients/${id}`, data),
  delete: (id) => backendClient.delete(`/ingredients/${id}`),
};
