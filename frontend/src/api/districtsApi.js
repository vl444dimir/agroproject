import backendClient from './backendClient';

export const districtsApi = {
  getAll: () => backendClient.get('/districts'),
  getById: (id) => backendClient.get(`/districts/${id}`),
};
