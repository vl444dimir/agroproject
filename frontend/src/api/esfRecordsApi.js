import backendClient from './backendClient';

/**
 * API для работы с записями ЭСФ (Spring Boot бэкенд).
 */
export const esfRecordsApi = {
  getAll: (params) => backendClient.get('/esf-records', { params }),
  update: (id, data) => backendClient.put(`/esf-records/${id}`, data),
};
