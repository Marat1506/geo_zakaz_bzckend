# Geo-Fenced Food Ordering Service - Backend

Production-ready NestJS backend для сервиса заказа еды с геолокационными ограничениями.

## ✅ Реализовано

- **Инфраструктура**: Docker Compose, PostgreSQL + PostGIS, Redis
- **Auth Module**: JWT аутентификация, User entity, Guards
- **Geo-Fence Module**: ServiceZone entity, проверка геолокации (круговые и полигональные зоны)
- **Menu Module**: MenuItem entity, READY NOW функция, кэширование
- **Order Module**: Order/OrderItem entities, создание заказов, статусы, ETA
- **File Upload Module**: Загрузка и сжатие изображений (локальное хранилище)
- **Миграции**: Начальная схема базы данных
- **Seed данные**: Admin пользователь, тестовая зона, меню

## Требования

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15 с PostGIS
- Redis 7

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
# Отредактируйте .env файл с вашими настройками
```

### 3. Запуск Docker контейнеров

```bash
docker-compose up -d
```

Это запустит:

- PostgreSQL с PostGIS на порту 5432
- Redis на порту 6379

### 4. Запуск миграций

```bash
npm run migration:run
```

### 5. Заполнение начальными данными

```bash
npm run seed
```

Это создаст:

- Admin пользователя (email: `admin@example.com`, пароль: `admin123`)
- Тестовую зону обслуживания (Main Parking Lot)
- 4 товара меню (2 READY NOW, 2 обычных)

### 6. Запуск приложения

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

Приложение будет доступно на `http://localhost:3000/api`

## API Endpoints

### Public Endpoints

#### Геолокация

- `POST /api/geo/check` - Проверка нахождения в зоне обслуживания
  ```json
  {
    "lat": 40.7128,
    "lng": -74.006
  }
  ```

#### Меню

- `GET /api/menu?zoneId={uuid}` - Получение меню (разделено на readyNow и regular)

#### Заказы

- `POST /api/orders` - Создание заказа (multipart/form-data)
  - Body: JSON с данными заказа
  - File: `carPhoto` - фото машины
- `GET /api/orders/:id` - Получение заказа по ID

#### Аутентификация

- `POST /api/auth/login` - Вход администратора
  ```json
  {
    "email": "admin@example.com",
    "password": "admin123"
  }
  ```
- `POST /api/auth/refresh` - Обновление токена
  ```json
  {
    "refreshToken": "..."
  }
  ```

### Admin Endpoints (требуют JWT токен)

Добавьте заголовок: `Authorization: Bearer {accessToken}`

#### Зоны обслуживания

- `GET /api/geo/admin/zones` - Список зон
- `POST /api/geo/admin/zones` - Создание зоны
- `PATCH /api/geo/admin/zones/:id` - Обновление зоны
- `DELETE /api/geo/admin/zones/:id` - Удаление зоны

#### Меню

- `GET /api/menu/admin` - Список всех товаров
- `GET /api/menu/admin/:id` - Получение товара
- `POST /api/menu/admin` - Создание товара
- `PATCH /api/menu/admin/:id` - Обновление товара
- `DELETE /api/menu/admin/:id` - Удаление товара
- `PATCH /api/menu/admin/:id/ready-now` - Переключение READY NOW

#### Заказы

- `GET /api/orders/admin/list?status={status}&zoneId={uuid}` - Список заказов
- `PATCH /api/orders/admin/:id/status` - Обновление статуса заказа

## Структура проекта

```
src/
├── config/              # Конфигурационные файлы
│   ├── database.config.ts
│   ├── jwt.config.ts
│   ├── redis.config.ts
│   └── typeorm.config.ts
├── modules/
│   ├── auth/           # Аутентификация
│   ├── geo/            # Геолокация
│   ├── menu/           # Меню
│   ├── orders/         # Заказы
│   └── files/          # Загрузка файлов
├── migrations/         # Миграции БД
├── seeds/              # Seed данные
├── app.module.ts
└── main.ts
```

## Переменные окружения

```env
# Application
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=food_ordering

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRATION=7d

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg
```

## Скрипты

```bash
# Development
npm run start:dev        # Запуск в режиме разработки
npm run build            # Сборка для production
npm run start:prod       # Запуск production сборки

# Database
npm run migration:run    # Запуск миграций
npm run migration:revert # Откат последней миграции
npm run seed             # Заполнение начальными данными

# Testing
npm run test             # Unit тесты
npm run test:e2e         # E2E тесты
npm run test:cov         # Coverage

# Code quality
npm run lint             # Линтинг
npm run format           # Форматирование
```

## Docker

### Запуск всего стека

```bash
docker-compose up -d
```

### Остановка

```bash
docker-compose down
```

### Просмотр логов

```bash
docker-compose logs -f backend
```

### Пересборка

```bash
docker-compose up -d --build
```

## Основные функции

### Геолокация

- Поддержка круговых зон (центр + радиус)
- Поддержка полигональных зон (GeoJSON)
- Кэширование активных зон в Redis (10 минут)
- Алгоритм Haversine для расчета расстояний

### Меню

- Разделение на READY NOW (2-3 минуты) и обычные товары
- Кэширование меню в Redis (5 минут)
- Фильтрация по зонам обслуживания
- Управление доступностью товаров

### Заказы

- Автоматическая проверка геолокации
- Загрузка и сжатие фото машины (локальное хранилище в папке uploads/)
- Расчет итоговой суммы
- Расчет ETA на основе readyNow товаров
- Генерация уникальных номеров заказов (ORD-YYYYMMDD-XXXX)
- Оптимистичная блокировка для обновления статусов
- Поддержка оплаты наличными

### Безопасность

- JWT аутентификация
- Role-based access control (Admin/Customer)
- CORS настройка
- Helmet для security headers
- Валидация всех входных данных
- Rate limiting (готово к подключению)

## Тестирование API

### Пример: Вход администратора

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Пример: Проверка геолокации

```bash
curl -X POST http://localhost:3000/api/geo/check \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7128,"lng":-74.006}'
```

### Пример: Получение меню

```bash
curl http://localhost:3000/api/menu
```

### Пример: Создание заказа

```bash
curl -X POST http://localhost:3000/api/orders \
  -F 'carPlateNumber=ABC123' \
  -F 'carColor=red' \
  -F 'customerLat=40.7128' \
  -F 'customerLng=-74.006' \
  -F 'paymentMethod=cash' \
  -F 'items=[{"menuItemId":"uuid","quantity":2}]' \
  -F 'carPhoto=@/path/to/photo.jpg'
```

## Troubleshooting

### PostgreSQL не запускается

```bash
docker-compose down -v
docker-compose up -d
```

### Ошибка миграций

```bash
npm run migration:revert
npm run migration:run
```

### Порт уже занят

Измените PORT в .env файле или остановите процесс на порту 3000

## Лицензия

UNLICENSED
