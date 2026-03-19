const fs = require('fs');
const path = require('path');

const apiDir = path.join('c:/Users/hohik/Desktop/agroproject/src', 'api');
if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir);
}

const clientCode = `import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  }
});

export default apiClient;
`;

const reportsCode = `import apiClient from './client';

export const reportsApi = {
  getReports: () => apiClient.get('/reports').catch(() => ({ data: [] })),
  getReportById: (id) => apiClient.get(\`/reports/\${id}\`),
  createReport: (data) => apiClient.post('/reports', data),
  updateReport: (id, data) => apiClient.put(\`/reports/\${id}\`, data),
  deleteReport: (id) => apiClient.delete(\`/reports/\${id}\`),
};
`;

const dashboardCode = `import apiClient from './client';

export const dashboardApi = {
  getKPI: () => apiClient.get('/kpi').catch(() => ({ data: {} })),
  getTopFertilizers: () => apiClient.get('/topFertilizers').catch(() => ({ data: [] })),
  getTopPesticides: () => apiClient.get('/topPesticides').catch(() => ({ data: [] })),
  getMapDistricts: () => apiClient.get('/mapDistricts').catch(() => ({ data: [] })),
};
`;

const referencesCode = `import apiClient from './client';

export const referencesApi = {
  getFertilizers: () => apiClient.get('/fertilizersRef').catch(() => ({ data: [] })),
  getPesticides: () => apiClient.get('/pesticidesRef').catch(() => ({ data: [] })),
};
`;

const documentsCode = `import apiClient from './client';

export const documentsApi = {
  getDocuments: () => apiClient.get('/documents').catch(() => ({ data: [] })),
};
`;

const supplyChainCode = `import apiClient from './client';

export const supplyChainApi = {
  getSupplyChain: () => apiClient.get('/supplyChain').catch(() => ({ data: [] })),
};
`;

const calculatorCode = `import apiClient from './client';

export const calculatorApi = {
  getCalcNorms: () => apiClient.get('/calcNorms').catch(() => ({ data: [] })),
};
`;

const authCode = `import apiClient from './client';

export const authApi = {
  getUsers: () => apiClient.get('/users').catch(() => ({ data: [] })),
};
`;

const auditCode = `import apiClient from './client';

export const auditApi = {
  getAuditLog: () => apiClient.get('/auditLog').catch(() => ({ data: [] })),
  createAuditLog: (logEntry) => apiClient.post('/auditLog', logEntry).catch(() => ({ data: {} })),
};
`;

const notificationsCode = `import apiClient from './client';

export const notificationsApi = {
  getNotifications: () => apiClient.get('/notifications').catch(() => ({ data: [] })),
};
`;

fs.writeFileSync(path.join(apiDir, 'client.js'), clientCode);
fs.writeFileSync(path.join(apiDir, 'reports.js'), reportsCode);
fs.writeFileSync(path.join(apiDir, 'dashboard.js'), dashboardCode);
fs.writeFileSync(path.join(apiDir, 'references.js'), referencesCode);
fs.writeFileSync(path.join(apiDir, 'documents.js'), documentsCode);
fs.writeFileSync(path.join(apiDir, 'supplyChain.js'), supplyChainCode);
fs.writeFileSync(path.join(apiDir, 'calculator.js'), calculatorCode);
fs.writeFileSync(path.join(apiDir, 'auth.js'), authCode);
fs.writeFileSync(path.join(apiDir, 'audit.js'), auditCode);
fs.writeFileSync(path.join(apiDir, 'notifications.js'), notificationsCode);
console.log("API directory and files created successfully.");
