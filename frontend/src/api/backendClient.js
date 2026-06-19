import axios from 'axios';
import { notification } from 'antd';

const backendClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
});

backendClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

backendClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      let description = error.response?.data?.message || 'Ошибка при запросе к серверу.';

      if (status === 401) {
        description = 'Необходима авторизация. Пожалуйста, войдите в систему.';
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('agro_user');
        // Force redirect to login to clear React state and allow a clean login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else if (status === 403) {
        description = 'Недостаточно прав для выполнения действия.';
      } else if (status === 500) {
        description = 'Внутренняя ошибка сервера. Попробуйте позже.';
      }

      notification.error({
        message: `Ошибка ${status}`,
        description,
        placement: 'bottomRight',
        duration: 5,
      });
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      notification.error({
        message: 'Сервер недоступен',
        description: 'Spring Boot бэкенд не запущен (порт 8080). Запустите бэкенд командой: ./gradlew bootRun',
        placement: 'bottomRight',
        duration: 8,
      });
    } else {
      notification.error({
        message: 'Backend Error',
        description: error.message || 'Неизвестная ошибка.',
        placement: 'bottomRight',
        duration: 5,
      });
    }
    return Promise.reject(error);
  }
);

export default backendClient;
