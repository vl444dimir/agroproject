import axios from 'axios';
import { notification } from 'antd';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Глобальный перехватчик ответов (Интерцептор)
apiClient.interceptors.response.use(
  (response) => {
    // Если запрос прошел успешно, просто возвращаем ответ
    return response;
  },
  (error) => {
    // В случае возникновения ошибки (например 4xx, 5xx), показываем красивое уведомление (UI/UX)
    notification.error({
      message: 'Network Error',
      description: error.response?.data?.message || 'Не удалось получить ответ от сервера. Проверьте подключение API.',
      placement: 'bottomRight',
      duration: 5,
    });
    
    // Бросаем ошибку дальше, если конкретный компонент хочет ее обработать индивидуально
    return Promise.reject(error);
  }
);

export default apiClient;
