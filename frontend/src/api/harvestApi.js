import backendClient from './backendClient';

export const harvestApi = {
  getAllRecords: (districtId) => {
    const params = districtId ? { districtId } : {};
    return backendClient.get('/harvest', { params });
  },
  createOrUpdateRecord: (data) => backendClient.post('/harvest', data),
};
