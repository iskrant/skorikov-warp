#!/usr/bin/env python3
"""
Скрипт для наложения подписи художника на все изображения картин
Требуется: pip install Pillow cairosvg
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cairosvg
import io
import shutil
import argparse

def setup_directories(input_path, output_path, backup=True):
    """Создает необходимые директории и резервные копии"""
    output_path = Path(output_path)
    input_path = Path(input_path)
    
    # Создаем папку для результата
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Создаем резервную копию
    if backup:
        backup_path = Path("assets/images_backup")
        if not backup_path.exists():
            print("Создаем резервную копию...")
            shutil.copytree(input_path, backup_path)
            print(f"Резервная копия создана: {backup_path}")
    
    return input_path, output_path

def convert_svg_to_png(svg_path, width, height):
    """Конвертирует SVG в PNG с заданными размерами"""
    try:
        # Читаем SVG файл
        with open(svg_path, 'r', encoding='utf-8') as f:
            svg_content = f.read()
        
        # Конвертируем SVG в PNG
        png_data = cairosvg.svg2png(
            bytestring=svg_content.encode('utf-8'),
            output_width=width,
            output_height=height
        )
        
        # Создаем PIL Image из PNG данных
        signature_image = Image.open(io.BytesIO(png_data))
        return signature_image
        
    except Exception as e:
        print(f"Ошибка конвертации SVG: {e}")
        return None

def add_signature_to_image(image_path, signature_svg_path, output_path):
    """Добавляет подпись на изображение"""
    try:
        # Открываем основное изображение
        with Image.open(image_path) as img:
            # Конвертируем в RGB если необходимо
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            width, height = img.size
            
            # Вычисляем размер подписи (15% от ширины)
            signature_width = max(100, int(width * 0.15))
            signature_height = int(signature_width * 0.33)  # соотношение 3:1
            
            # Конвертируем SVG в PNG
            signature = convert_svg_to_png(signature_svg_path, signature_width, signature_height)
            if signature is None:
                return False
            
            # Позиция для левого нижнего угла (с отступами)
            offset_x = int(width * 0.02)
            offset_y = int(height * 0.02)
            position = (offset_x, height - signature_height - offset_y)
            
            # Накладываем подпись
            img.paste(signature, position, signature if signature.mode == 'RGBA' else None)
            
            # Сохраняем результат
            img.save(output_path, 'JPEG', quality=95)
            return True
            
    except Exception as e:
        print(f"Ошибка обработки изображения {image_path}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Добавить подпись художника на изображения')
    parser.add_argument('--input', default='assets/images', help='Папка с исходными изображениями')
    parser.add_argument('--output', default='assets/images_signed', help='Папка для результата')
    parser.add_argument('--signature', default='themes/gallery/static/images/artist_signature.svg', 
                       help='Путь к SVG подписи')
    parser.add_argument('--no-backup', action='store_true', help='Не создавать резервную копию')
    
    args = parser.parse_args()
    
    # Проверяем наличие зависимостей
    try:
        import cairosvg
        from PIL import Image
    except ImportError as e:
        print(f"Ошибка импорта: {e}")
        print("Установите зависимости: pip install Pillow cairosvg")
        sys.exit(1)
    
    # Настраиваем директории
    input_path, output_path = setup_directories(args.input, args.output, not args.no_backup)
    
    # Ищем изображения картин
    image_extensions = {'.jpg', '.jpeg', '.JPG', '.JPEG'}
    exclude_files = {'avatar', 'brush', 'qr', 'tel', 'social'}
    
    image_files = []
    for ext in image_extensions:
        for img_file in input_path.glob(f'*{ext}'):
            # Исключаем служебные файлы
            if not any(exclude in img_file.stem.lower() for exclude in exclude_files):
                image_files.append(img_file)
    
    print(f"Найдено {len(image_files)} изображений для обработки")
    
    if not image_files:
        print("Изображения для обработки не найдены!")
        return
    
    # Проверяем наличие файла подписи
    signature_path = Path(args.signature)
    if not signature_path.exists():
        print(f"Файл подписи не найден: {signature_path}")
        return
    
    # Обрабатываем изображения
    processed = 0
    errors = 0
    
    for img_file in image_files:
        output_file = output_path / img_file.name
        print(f"Обрабатываем: {img_file.name}")
        
        if add_signature_to_image(img_file, signature_path, output_file):
            print(f"✓ Обработано: {img_file.name}")
            processed += 1
        else:
            print(f"✗ Ошибка: {img_file.name}")
            errors += 1
    
    print(f"\nОбработка завершена!")
    print(f"Успешно обработано: {processed} файлов")
    if errors > 0:
        print(f"Ошибок: {errors}")
    
    print(f"\nОбработанные изображения сохранены в: {output_path}")
    
    # Предлагаем заменить оригиналы
    replace = input("\nЗаменить оригинальные файлы обработанными? (y/N): ")
    if replace.lower() == 'y':
        print("Заменяем оригинальные файлы...")
        
        for output_file in output_path.glob('*.jpg'):
            original_file = input_path / output_file.name
            if original_file.exists():
                shutil.copy2(output_file, original_file)
                print(f"Заменен: {output_file.name}")
        
        print("Готово! Все файлы заменены.")
        print("Резервные копии находятся в: assets/images_backup")

if __name__ == "__main__":
    main()
