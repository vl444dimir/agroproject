import backendClient from './backendClient';

const toFormData = (file, extra) => {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(extra || {}).forEach(([k, v]) => fd.append(k, v));
  return fd;
};

export const importApi = {
  getEntities: () => backendClient.get('/import/entities'),

  getMetadata: (entityName) => backendClient.get(`/import/metadata/${entityName}`),

  parseFile: (file) => backendClient.post('/import/parse', toFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  analyze: (entityName, file, mapping) => backendClient.post(
    `/import/analyze/${entityName}`,
    toFormData(file, { mapping: JSON.stringify(mapping) }),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ),

  execute: (entityName, file, request) => backendClient.post(
    `/import/execute/${entityName}`,
    toFormData(file, { request: JSON.stringify(request) }),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ),
};
