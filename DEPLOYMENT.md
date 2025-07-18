# Инструкции по деплою на GitHub Pages

## Настройка GitHub Pages

### 1. Создание репозитория
1. Создайте новый публичный репозиторий на GitHub
2. Название может быть любым (например, `skorikov-gallery`)
3. НЕ инициализируйте репозиторий с README, .gitignore или лицензией

### 2. Загрузка кода
```bash
# Добавьте remote origin (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/skorikov-gallery.git

# Переименуйте ветку в main (если она называется master)
git branch -M main

# Загрузите код
git push -u origin main
```

### 3. Настройка GitHub Pages
1. Перейдите в настройки репозитория (`Settings`)
2. В левом меню найдите раздел `Pages`
3. В разделе `Source` выберите `GitHub Actions`
4. Сохраните настройки

### 4. Обновление конфигурации
Отредактируйте файл `hugo.toml` и обновите `baseURL`:
```toml
baseURL = 'https://YOUR_USERNAME.github.io/skorikov-gallery'
```

### 5. Деплой
```bash
# Зафиксируйте изменения baseURL
git add hugo.toml
git commit -m "Update baseURL for GitHub Pages"
git push origin main
```

## Автоматический деплой

### Триггеры деплоя
Сайт автоматически деплоится при:
- Пуше в ветку `main` или `master`
- Ручном запуске через GitHub Actions

### Процесс деплоя
1. **Build** (сборка):
   - Установка Hugo Extended 0.148.0
   - Установка Dart Sass
   - Checkout кода
   - Сборка сайта с минификацией
   - Оптимизация изображений

2. **Deploy** (деплой):
   - Автоматическая публикация на GitHub Pages
   - Доступность по URL: `https://YOUR_USERNAME.github.io/skorikov-gallery`

### Мониторинг деплоя
1. Перейдите во вкладку `Actions` в репозитории
2. Следите за статусом деплоя
3. При ошибках проверьте логи сборки

## Обновление сайта

### Добавление новых картин
1. Поместите изображения в папку `assets/images/`
2. Зафиксируйте изменения:
   ```bash
   git add assets/images/
   git commit -m "Add new paintings"
   git push origin main
   ```
3. Сайт автоматически пересоберется и обновится

### Изменение информации о художнике
Отредактируйте файл `hugo.toml`:
```toml
[params]
  artist_name = "Скориков Игорь Андреевич"
  artist_title = "Член союза художников России"
  phone = "+79081234567"
  email = "skorikov.igor@gmail.com"
  telegram = "@Igor_Skorikov"
```

## Возможные проблемы

### Сайт не отображается
1. Проверьте статус деплоя в `Actions`
2. Убедитесь, что `baseURL` настроен правильно
3. Проверьте, что GitHub Pages включен в настройках

### Изображения не загружаются
1. Убедитесь, что изображения в папке `assets/images/`
2. Проверьте поддерживаемые форматы: JPG, JPEG, PNG, GIF, WEBP
3. Убедитесь, что файлы не слишком большие (рекомендуется до 10MB)

### Ошибки сборки
1. Проверьте логи в GitHub Actions
2. Убедитесь, что структура файлов корректна
3. Проверьте синтаксис в `hugo.toml`

## Доменное имя (опционально)

Если у вас есть собственный домен:
1. Создайте файл `static/CNAME` с содержимым:
   ```
   yourdomain.com
   ```
2. Обновите `baseURL` в `hugo.toml`:
   ```toml
   baseURL = 'https://yourdomain.com'
   ```
3. Настройте DNS записи у вашего регистратора домена
