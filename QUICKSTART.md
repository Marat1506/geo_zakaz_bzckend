# 🚀 Быстрый старт

## Шаг 1: Запуск Docker контейнеров

```bash
docker-compose up -d
```

Подождите 10-15 секунд, пока PostgreSQL и Redis полностью запустятся.

## Шаг 2: Запуск миграций

```bash
npm run migration:run
```

## Шаг 3: Заполнение тестовыми данными

```bash
npm run seed
```

Это создаст:

- ✅ Admin: `admin@example.com` / `admin123`
- ✅ Тестовую зону обслуживания
- ✅ 4 товара меню (2 READY NOW)

## Шаг 4: Запуск приложения

```bash
npm run start:dev
```

Приложение запустится на `http://localhost:3000/api`

## 🧪 Тестирование

### 1. Вход администратора

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Сохраните `accessToken` из ответа.

### 2. Проверка геолокации

```bash
curl -X POST http://localhost:3000/api/geo/check \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7128,"lng":-74.006}'
```

Должен вернуть `"inZone": true`

### 3. Получение меню

```bash
curl http://localhost:3000/api/menu
```

Должен вернуть 2 товара в `readyNow` и 2 в `regular`

### 4. Создание заказа

Сначала подготовьте фото (любое изображение):

```bash
curl -X POST http://localhost:3000/api/orders \
  -F 'carPlateNumber=ABC123' \
  -F 'customerLat=40.7128' \
  -F 'customerLng=-74.006' \
  -F 'paymentMethod=cash' \
  -F 'items=[{"menuItemId":"<UUID_из_меню>","quantity":2}]' \
  -F 'carPhoto=@photo.jpg'
```

### 5. Получение списка заказов (Admin)

```bash
curl http://localhost:3000/api/orders/admin/list \
  -H "Authorization: Bearer <accessToken>"
```

## ✅ Готово!

Ваш backend полностью настроен и готов к работе.

## 📝 Следующие шаги

- Изучите [README.md](./README.md) для полной документации API
- Настройте переменные окружения в `.env`
- Добавьте свои зоны обслуживания через admin API
- Настройте меню через admin API

## 🐛 Проблемы?

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

### Порт 3000 занят

Измените `PORT=3001` в `.env` файле
