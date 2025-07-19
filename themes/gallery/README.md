# Gallery Theme Documentation

## Overview

This Hugo theme creates a responsive gallery with automatic title generation from filenames and advanced lightbox functionality.

## Features

- 🏷️ **Automatic Title Generation** - Creates human-readable titles from image filenames
- 🧹 **Smart Filename Cleaning** - Removes technical patterns and prefixes
- 🌍 **UTF-8 Support** - Full support for Cyrillic and other Unicode characters
- 📱 **Mobile Responsive** - Adaptive layouts for all screen sizes
- ⚡ **Performance Optimized** - Pre-cleaned titles for fast navigation

## Title Generation System

### How It Works

The gallery automatically generates titles for images in the lightbox using a two-stage process:

1. **Hugo Template Stage**: Extracts filename from image resources
2. **JavaScript Stage**: Applies advanced cleaning rules to create human-readable titles

### Filename Cleaning Rules

The JavaScript `cleanFilenameToTitle()` function applies these transformations:

#### 1. Extension Removal
```javascript
title.replace(/\.\w+$/, '')
```
- Removes file extensions: `.jpg`, `.png`, `.jpeg`, etc.
- **Example**: `"painting.jpg"` → `"painting"`

#### 2. Size Pattern Removal  
```javascript
title.replace(/\s+\d+х\d+$/i, '')
```
- Removes dimension patterns at the end of filenames
- **Examples**: 
  - `"Август 90х110"` → `"Август"`
  - `"Portrait 1920x1080"` → `"Portrait"`

#### 3. Underscore to Space Conversion
```javascript
title.replace(/_/g, ' ')
```
- Converts underscores to spaces for readability
- **Example**: `"my_painting_title"` → `"my painting title"`

#### 4. LIS_ Prefix Removal
```javascript
title.replace(/^LIS\s+/i, '')
```
- Removes "LIS" prefix (case-insensitive) after underscore conversion
- **Examples**:
  - `"LIS_3580"` → `"3580"`
  - `"LIS_portrait-2"` → `"portrait-2"`

#### 5. Whitespace Cleanup
```javascript
title.replace(/\s+/g, ' ').trim()
```
- Normalizes multiple spaces to single spaces
- Trims leading and trailing whitespace

### Example Transformations

| Original Filename | Final Title |
|------------------|-------------|
| `LIS_3580.JPG` | `3580` |
| `Август 90х110.jpg` | `Август` |
| `Автопортрет 74х64.jpg` | `Автопортрет` |
| `my_beautiful_painting_1920x1080.png` | `my beautiful painting` |
| `Portrait_of_Artist.jpeg` | `Portrait of Artist` |

## Configuration

### Enabling/Disabling Titles

The title system is controlled by the `data-title` attribute in the HTML template.

#### Current Implementation (Enabled)
```html
<!-- In themes/gallery/layouts/index.html -->
<div class="gallery-item" 
     data-index="{{ $index }}" 
     data-full="{{ $image.RelPermalink }}" 
     data-title="{{ $image.Name }}">
```

#### To Disable Titles
Remove or comment out the `data-title` attribute:
```html
<div class="gallery-item" 
     data-index="{{ $index }}" 
     data-full="{{ $image.RelPermalink }}">
     <!-- data-title="{{ $image.Name }}" -->
```

### Customizing Title Cleaning

To modify the title cleaning logic, edit the `cleanFilenameToTitle()` function in:
- `themes/gallery/static/js/gallery.js`

#### Example: Adding Custom Pattern Removal
```javascript
static cleanFilenameToTitle(filename) {
    if (!filename) return '';
    
    let title = filename;
    
    // Remove file extension
    title = title.replace(/\.\w+$/, '');
    
    // Remove size patterns
    title = title.replace(/\s+\d+х\d+$/i, '');
    
    // YOUR CUSTOM RULES HERE
    // Example: Remove "ARTWORK_" prefix
    title = title.replace(/^ARTWORK_/i, '');
    
    // Convert underscores to spaces
    title = title.replace(/_/g, ' ');
    
    // Remove LIS prefix
    title = title.replace(/^LIS\s+/i, '');
    
    // Clean up whitespace
    title = title.replace(/\s+/g, ' ').trim();
    
    return title;
}
```

## File Structure

```
themes/gallery/
├── layouts/
│   ├── _default/
│   │   ├── baseof.html          # Base template with lightbox structure
│   │   └── gallery.html         # Gallery grid template (legacy)
│   └── index.html               # Main gallery template with data-title
├── static/
│   ├── css/
│   │   └── gallery.css          # Lightbox title styling
│   └── js/
│       └── gallery.js           # Title generation logic
└── README.md                    # This documentation
```

## CSS Classes

### Lightbox Title Styling
```css
.lightbox-title {
    margin-top: 8px;
    font-size: 1rem;
    color: #e0e0e0;
    text-align: center;
    max-width: 90vw;
    word-wrap: break-word;
}

/* Mobile responsive */
@media (max-width: 600px) {
    .lightbox-title {
        font-size: 0.9rem;
    }
}
```

## JavaScript API

### Key Methods

#### `Gallery.cleanFilenameToTitle(filename)`
- **Static method** for cleaning filenames
- **Parameters**: `filename` (string) - The raw filename
- **Returns**: (string) - Cleaned, human-readable title
- **Usage**: `const title = Gallery.cleanFilenameToTitle("LIS_3580.JPG")`

#### `createOrUpdateTitle()`
- Creates title element on lightbox open
- Called automatically by `openLightbox()`

#### `updateTitle()`
- Updates title text during navigation
- Called automatically by `showNext()` and `showPrevious()`

## Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Full UTF-8/Unicode support for international characters
- ✅ Responsive design for all screen sizes

## Performance Notes

- **Pre-processed titles**: Filenames are cleaned once during gallery initialization
- **Fast navigation**: Title updates use pre-cleaned data from memory
- **No runtime URL parsing**: Titles are stored alongside image sources
- **Minimal DOM manipulation**: Title element created once, text updated as needed

## Troubleshooting

### Titles Not Appearing
1. Check that `data-title` attribute exists in HTML
2. Verify JavaScript is loading properly
3. Check browser console for errors

### Incorrect Title Cleaning
1. Test the `cleanFilenameToTitle()` function in browser console
2. Verify regex patterns match your filename conventions
3. Add custom rules for specific filename patterns

### UTF-8 Character Issues
1. Ensure HTML has `<meta charset="UTF-8">`
2. Verify server serves files with correct encoding
3. Check that image filenames are properly encoded

## Contributing

When modifying the title system:

1. Update both the JavaScript function and this documentation
2. Test with various filename patterns including:
   - Cyrillic/Unicode characters
   - Size patterns (90х110, 1920x1080)
   - Underscore variations
   - LIS_ prefixes
   - Edge cases (empty strings, special characters)
3. Verify mobile responsiveness
4. Test performance with large galleries (50+ images)
