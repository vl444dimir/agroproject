import backendClient from './backendClient';

/**
 * API для работы с контрагентами (Spring Boot бэкенд).
 */
export const organizationsApi = {
  getAll: (params) => backendClient.get('/organizations', { params }),
  merge: (sourceId, targetId) => backendClient.post(`/organizations/merge?sourceId=${sourceId}&targetId=${targetId}`),
};
