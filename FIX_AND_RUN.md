# 🔧 Исправление и запуск

## Проблемы исправлены:

✅ Убраны переменные Stripe и AWS из docker-compose.yml
✅ Добавлен флаг `--legacy-peer-deps` в Dockerfile для решения конфликта зависимостей
✅ Обновлена версия @nestjs/mapped-types

## Запуск Docker

Выполните эту команду в терминале:

```bash
docker-compose up -d --build
```

Это займет 2-3 минуты при первом запуске (сборка образа).

## После успешного запуска Docker:

### 1. Проверьте, что контейнеры запущены:

```bash
docker-compose ps
```

Должны быть запущены:

- food-ordering-postgres (healthy)
- food-ordering-redis (healthy)
- food-ordering-backend (running)

### 2. Запустите миграции:

```bash
npm run migration:run
```

### 3. Заполните тестовыми данными:

```bash
npm run seed
```

### 4. Проверьте логи backend:

```bash
docker-compose logs -f backend
```

Должно быть: `Application is running on: http://localhost:3000/api`

## Альтернатива: Запуск без Docker

Если Docker не работает, можно запустить локально:

### 1. Запустите только PostgreSQL и Redis:

```bash
docker-compose up -d postgres redis
```

### 2. Установите зависимости:

```bash
npm install --legacy-peer-deps
```

### 3. Запустите миграции:

```bash
npm run migration:run
```

### 4. Заполните данными:

```bash
npm run seed
```

### 5. Запустите приложение:

```bash
npm run start:dev
```

## Тестирование

После запуска проверьте:

```bash
# Проверка здоровья
curl http://localhost:3000/api

# Вход администратора
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Проверка геолокации
curl -X POST http://localhost:3000/api/geo/check \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7128,"lng":-74.006}'

# Получение меню
curl http://localhost:3000/api/menu
```

## Если возникли проблемы:

### Очистка Docker:

```bash
docker-compose down -v
docker-compose up -d --build
```

### Проверка логов:

```bash
# Логи всех сервисов
docker-compose logs

# Логи конкретного сервиса
docker-compose logs postgres
docker-compose logs redis
docker-compose logs backend
```

### Проверка портов:

```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Если порт занят, измените PORT в .env файле
```
