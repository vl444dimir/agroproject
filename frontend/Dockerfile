# Стейдж 1: Сборка приложения
FROM --platform=linux/amd64 node:22 AS builder

WORKDIR /app

# Копируем package.json
COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm install --legacy-peer-deps

# Копируем исходный код
COPY . .

# Принимаем переменную окружения как аргумент во время сборки
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Собираем production билд
RUN npm run build

# Стейдж 2: Nginx сервер для статических файлов
FROM --platform=linux/amd64 nginx:1.25

# Удаляем дефолтные статические файлы Nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем результаты сборки из первого стейджа
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем наш кастомный конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем 80 порт
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
