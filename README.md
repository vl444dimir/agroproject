# DalaInfo (Agromonitoring)

Информационно-аналитическая система для мониторинга применения удобрений и пестицидов в аграрном секторе. Монорепозиторий: React SPA (фронтенд) + Spring Boot API (бэкенд).

---

## Стек технологий

### Frontend
- **Ядро:** React 18, Vite, React Router v6 (ленивая загрузка всех страниц)
- **UI:** Ant Design (ConfigProvider с русской локализацией), Recharts, Leaflet / React-Leaflet
- **Сеть:** Axios (два клиента — `backendClient` на `/api/v1` и `client` на `http://localhost:3001`)
- **Документы:** jsPDF, docx, xlsx (клиентский парсинг Excel через `xlsx`)
- **Состояние:** React Context (авторизация), localStorage (токен, пользователь, история калькулятора)

### Backend (git-подмодуль)
- Java 21, Spring Boot 4.0.5, PostgreSQL 14+, Spring Security + JWT, Gradle, Lombok
- Репозиторий: `https://github.com/nikitabalshov/agro-back`

---

## Статус разработки

Фронтенд значительно опережает бэкенд. Реализована **двухуровневая архитектура API**:

| Клиент | Базовый URL | Назначение | Статус |
|--------|-------------|------------|--------|
| `backendClient` | `/api/v1` (прокси Vite → `:8080`) | Авторизация, продукты, категории, культуры, районы, субсидии, импорт | Работает с реальным бэкендом |
| `client` | `VITE_API_BASE_URL` (`:3001`) | Дашборд, отчёты, справочники, документы, аудит, калькулятор | Мок (json-server) |

Страницы, не имеющие бэкенд-контроллеров, автоматически переключаются на демо-данные при недоступности сервера.

---

## Страницы и возможности

| Страница | Маршрут | Доступ | Источник данных | Функции |
|----------|---------|--------|-----------------|---------|
| **Вход** | `/login` | Все | backendClient | Логин / регистрация (JWT) |
| **Дашборд** | `/` | Все | Мок | KPI-карточки, карта Leaflet, топ-10 графиков, рекомендации ИИ, детализация участков (employee/admin) |
| **Субсидии и отчёты** | `/reports` | Все | Мок | Таблица с фильтрами, экспорт PDF/Excel/DOCX, AI-анализ (employee/admin), поиск аналогов, анализ эффективности |
| **Заявки на субсидии** | `/subsidies` | Все | backendClient (+ демо) | CRUD заявок, детали, выгрузка сводного и группированного Excel |
| **Учёт урожая** | `/harvest` | Все | backendClient (+ демо) | Таблица/график, фильтр по району, добавление записей |
| **Калькулятор** | `/calculator` | Все | Мок | Расчёт норм удобрений/пестицидов по культуре, история в localStorage |
| **Справочники** | `/references` | Все | Мок | Удобрения / пестициды, модерация (user → proposed → admin:approve), поиск аналогов |
| **Формирование отчётов** | `/reporting` | Все | Мок | Конструктор с фильтрами (районы, культуры, годы), AI-оценка рисков |
| **Реестр препаратов** | `/products` | Staff/Admin | backendClient | CRUD продуктов, модалка аналогов |
| **Справочники бэкенда** | `/backend-refs` | Staff/Admin | backendClient | CRUD-табы: производители, категории, культуры, районы (read-only), действующие вещества |
| **Управление документами** | `/documents` | Staff/Admin | Мок | Загрузка Excel → клиентский парсинг в JSON, цепочка поставок (Steps) |
| **Импорт из Excel** | `/import` | Staff/Admin | backendClient (+ демо) | 4-шаговый мастер: выбор сущности → загрузка → маппинг колонок → анализ (DRY RUN) → импорт со стратегией |
| **Аудит событий** | `/audit` | Admin | Мок | Лог с фильтрами (дата, действие), статистика, экспорт в Excel |

### Ролевая модель
- **user** — базовая роль: дашборд, отчёты, субсидии, урожай, калькулятор, справочники (только предложения на модерацию)
- **employee / staff** — дополнительно: реестр препаратов, справочники бэкенда, документы, импорт, одобрение предложений
- **admin** — всё выше + удаление записей, аудит событий

---

## Схема маршрутизации запросов

```
Браузер → Vite Dev Server (:5173)
             ├── /api/v1/* → прокси → Java Backend (:8080)
             └── /api/*     → напрямую → json-server (:3001) [мок]
```

В `vite.config.js` настроен proxy для `/api`.

---

## Структура репозитория

```
agroproject/
├── backend/                  # git-подмодуль: Java Spring Boot
│   ├── build.gradle.kts
│   ├── Dockerfile
│   └── src/main/java/agro_back/demo/
│       ├── config/           # Spring Security, CORS
│       ├── controller/       # Auth, Product, заглушки Calculator/Stats
│       ├── dto/              # AuthRequest и т.д.
│       ├── entity/           # User, Product
│       ├── repository/       # Spring Data JPA
│       ├── security/         # JWT, фильтры
│       └── service/          # Бизнес-логика
│
├── frontend/                 # React SPA
│   ├── db.json               # Мок-данные для json-server
│   ├── package.json
│   ├── vite.config.js        # Прокси /api → :8080
│   ├── nginx.conf            # SPA-конфиг для продакшна
│   ├── docker-compose.yml    # Frontend + json-server
│   └── src/
│       ├── api/              # HTTP-клиенты (backendClient + client)
│       ├── components/        # Layout (Header, Sider)
│       ├── context/           # AuthContext (JWT, localStorage)
│       ├── mock/              # Инициализация мок-данных
│       ├── pages/             # 13 страниц (ленивая загрузка)
│       ├── router/            # ProtectedRoute + ролевая маршрутизация
│       └── styles/            # global.css (агро-стили, Leaflet)
│
├── .gitmodules               # backend → nikitabalshov/agro-back
├── AGENTS.md
└── README.md
```

---

## Инструкция по локальному запуску

### 1. PostgreSQL
```sql
CREATE DATABASE agro_db;
```

### 2. Backend
```bash
cd backend
./gradlew bootRun    # порт 8080
```

### 3. Mock-сервер
```bash
cd frontend
npm install
npm run server       # json-server на порту 3001
```

### 4. Frontend
```bash
cd frontend
npm run dev          # Vite на порту 5173
```

### Альтернатива: Docker
```bash
cd frontend
docker-compose up    # фронтенд + json-server
```

---

## Прокси и CORS

- Vite проксирует `/api` на `http://127.0.0.1:8080` (backend)
- В `nginx.conf` настроен SPA-fallback для React Router
- CORS настроен на Spring Boot для портов 5173 и 3001
