import apiClient from './client';

export const documentsApi = {
  getDocuments: () => apiClient.get('/documents').catch(() => ({ data: [] })),
};

export const supplyChainApi = {
  getSupplyChain: () => apiClient.get('/supplyChain').catch(() => ({ data: [] })),
};

export const calculatorApi = {
  getCalcNorms: () => apiClient.get('/calcNorms').catch(() => ({ data: [] })),
};

export const authApi = {
  getUsers: () => apiClient.get('/users').catch(() => ({ data: [] })),
};

export const auditApi = {
  getAuditLog: () => apiClient.get('/auditLog').catch(() => ({ data: [] })),
  createAuditLog: (logEntry) => apiClient.post('/auditLog', logEntry).catch(() => ({ data: {} })),
};

export const notificationsApi = {
  getNotifications: () => apiClient.get('/notifications').catch(() => ({ data: [] })),
};
