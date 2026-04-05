import backendClient from './backendClient';

export const productsApi = {
  getProducts: () => backendClient.get('/products'),
  getProductById: (id) => backendClient.get(`/products/${id}`),
  createProduct: (product) => backendClient.post('/products', product),
  updateProduct: (id, product) => backendClient.put(`/products/${id}`, product),
  deleteProduct: (id) => backendClient.delete(`/products/${id}`),
};
