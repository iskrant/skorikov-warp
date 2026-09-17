# Галерея Скорикова Игоря Андреевича

Сайт: https://skorikov.su/ · GitHub Pages: https://skorikov-igor.github.io/

Исходники в `iskrant/skorikov-warp` автоматически копируются в
`skorikov-igor/skorikov-igor.github.io` по расписанию (каждые 5 минут, возможны
задержки GitHub Actions). После обновления зеркала сайт Pages пересобирается.
Изменения вносите в основной репозиторий; зеркало обновляется только fast-forward.

Для работы со служебными документами и доступами после клонирования см.
[PRIVATE.md](PRIVATE.md): `python3 scripts/private.py unseal`.

Одностраничная галерея работ художника Скорикова Игоря Андреевича, созданная на базе Hugo для размещения на GitHub Pages.

## Возможности

- 🧱 **Masonry layout** - плотная упаковка картин без промежутков, как кирпичная кладка
- 📸 Сохранение оригинальных пропорций всех картин
- 🔍 Полноэкранный просмотр изображений в высоком качестве
- 📱 Адаптивный дизайн для мобильных устройств
- 👆 **Расширенная тач-навигация** - свайпы влево/вправо/вниз/вверх, пинч для масштабирования
- ⌨️ Навигация с клавиатуры (стрелки, Escape)
- 🖼️ Автоматическая генерация миниатюр с сохранением пропорций
- ⚡ Быстрая загрузка с предзагрузкой соседних изображений
- 🎨 Изображения не деформируются и не растягиваются в превью
- 📱 **QR-код** в верхней части для быстрого доступа к контактам
- 📞 **Иконка телефона** для удобного связи
- 🖌️ **Художественный футер** с кистью и подписью автора
- 🎨 **Темная цветовая схема** - элегантный темно-серый фон (#37393a)
- ✨ **Золотисто-серый градиент** для header и footer (#3d3700 → #37393a)

## Установка и настройка

### 1. Создание репозитория на GitHub

1. Создайте новый публичный репозиторий на GitHub (например, `skorikov-gallery`)
2. Не добавляйте README, .gitignore или лицензию при создании

### 2. Загрузка кода

Загрузите этот код в ваш репозиторий:

```bash
cd /путь/к/этой/папке
git remote add origin https://github.com/YOUR_USERNAME/skorikov-gallery.git
git branch -M main
git push -u origin main
```

### 3. Настройка GitHub Pages

1. В настройках репозитория перейдите в раздел `Pages`
2. В разделе `Source` выберите `GitHub Actions`
3. Обновите `baseURL` в файле `hugo.toml`:
   ```toml
   baseURL = 'https://YOUR_USERNAME.github.io/skorikov-gallery'
   ```
4. Сделайте commit и push - сайт автоматически задеплоится

📋 **Подробные инструкции по деплою см. в файле [DEPLOYMENT.md](DEPLOYMENT.md)**

### 2. Установка Hugo

Убедитесь, что у вас установлен Hugo Extended версии 0.110.0 или выше:

```bash
# Ubuntu/Debian
sudo snap install hugo

# macOS
brew install hugo

# Windows
winget install Hugo.Hugo.Extended
```

### 3. Добавление изображений

Поместите все изображения картин в папку `assets/images/`:

```
assets/
└── images/
    ├── painting1.jpg
    ├── painting2.png
    ├── painting3.jpeg
    └── ...
```

Поддерживаемые форматы: JPG, JPEG, PNG, GIF, WEBP

### 4. Локальная разработка

```bash
hugo server -D
```

Сайт будет доступен по адресу `http://localhost:1313`

### 5. Деплой на GitHub Pages

1. Создайте новый репозиторий на GitHub
2. Загрузите код:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/skorikov-gallery.git
   git branch -M main
   git push -u origin main
   ```
3. В настройках репозитория включите GitHub Pages с источником "GitHub Actions"
4. Обновите `baseURL` в файле `hugo.toml`:
   ```toml
   baseURL = 'https://YOUR_USERNAME.github.io/skorikov-gallery'
   ```

## Настройка контактной информации

Отредактируйте файл `hugo.toml`:

```toml
[params]
  artist_name = "Скориков Игорь Андреевич"
  artist_title = "Член союза художников России"
  vk = "https://vk.com/igorandreev12345"
  email = "skorikov.igor@gmail.com"
  telegram = "@Igor_Skorikov"
```

## Управление галереей

### Добавление новых изображений

1. Поместите изображения в папку `assets/images/`
2. Выполните коммит и пуш изменений
3. Сайт автоматически пересоберется и обновится

### Удаление изображений

1. Удалите изображения из папки `assets/images/`
2. Выполните коммит и пуш изменений

## Навигация

- **Клик по изображению** - открыть полноэкранный просмотр
- **Клик мимо изображения** - закрыть просмотр
- **Стрелки ← →** - предыдущее/следующее изображение
- **Escape** - закрыть просмотр
- **Свайп влево/вправо** - навигация по изображениям (мобильные, работает только при обычном размере)
- **Свайп вниз/вверх** - закрыть просмотр (мобильные)
- **Пинч для масштабирования** - увеличение/уменьшение изображения (мобильные, отключает навигацию свайпами)

## Техническая информация

- **Фреймворк**: Hugo
- **Автогенерация миниатюр**: Hugo Image Processing
- **Деплой**: GitHub Actions
- **Хостинг**: GitHub Pages

## Поддержка

По вопросам использования обращайтесь к разработчику.

### Filename Conventions

Images should be placed in the `assets/images/` directory. The supported formats are JPG, JPEG, PNG, GIF, and WEBP. The filenames are used to generate image titles, with extensions stripped using a regex pattern.

**Example Filename:**

- `painting1.jpg` will be displayed with the title `painting1`.

### Regex Logic

- A regex pattern is used in the `gallery.html` layout to strip the extension from filenames: 
   ```go
   {{ $image.Name | replaceRE "\\.(jpg|png|jpeg)$" "" }}
   ```
   This pattern removes common image file extensions.

### Disabling Titles

If you wish to disable titles, modify the HTML data attribute in the `gallery.html` file by removing or commenting out `data-title`.

**Instructions:**

1. Open the `gallery.html` file located at:
   - `themes/gallery/layouts/_default/gallery.html`

2. Locate the line with `data-title`:
   ```html
   <div class="gallery-item" data-index="{{ $index }}" data-full="{{ $image.RelPermalink }}" data-title="{{ $image.Name | replaceRE "\\.(jpg|png|jpeg)$" "" }}">
   ```

3. Remove or comment out the `data-title` segment to disable titles.

4. Save the file and rebuild your project.
