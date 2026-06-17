import backendClient from './backendClient';

export const referencesApi = {
  // На бэкенде пока все препараты лежат в /products, можно сделать фильтрацию по категории позже
  getFertilizers: () => backendClient.get('/products?categoryName=Удобрения').catch(() => ({ data: [] })),
  getPesticides: () => backendClient.get('/products?categoryName=Пестициды').catch(() => ({ data: [] })),
  getCultures: () => backendClient.get('/cultures').catch(() => ({ data: [] })),
  getDistricts: () => backendClient.get('/districts').catch(() => ({ data: [] })),

  getIngredients: () => backendClient.get('/ingredients').catch(() => ({ data: [] })),
  getCategories: () => backendClient.get('/categories').catch(() => ({ data: [] })),
  getManufacturers: () => backendClient.get('/manufacturers').catch(() => ({ data: [] })),
  createProduct: (product) => backendClient.post('/products', product),
  updateProduct: (id, product) => backendClient.put(`/products/${id}`, product),
  deleteProduct: (id) => backendClient.delete(`/products/${id}`),
};
