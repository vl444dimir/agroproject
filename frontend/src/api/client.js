import axios from 'axios';
import { notification } from 'antd';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
});

// Глобальный перехватчик ответов (Интерцептор)
apiClient.interceptors.response.use(
  (response) => {
    // Если запрос прошел успешно, просто возвращаем ответ
    return response;
  },
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      notification.error({
        message: 'JSON-Server недоступен',
        description: 'Запустите json-server командой: npm run server (порт 3001)',
        placement: 'bottomRight',
        duration: 8,
      });
    } else {
      notification.error({
        message: 'Ошибка данных',
        description: error.response?.data?.message || 'Не удалось получить данные. Проверьте json-server.',
        placement: 'bottomRight',
        duration: 5,
      });
    }
    
    // Бросаем ошибку дальше, если конкретный компонент хочет ее обработать индивидуально
    return Promise.reject(error);
  }
);

export default apiClient;
