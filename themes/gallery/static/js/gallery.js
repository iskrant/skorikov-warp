class Gallery {
    constructor() {
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImage = document.getElementById('lightbox-image');
        this.galleryItems = document.querySelectorAll('.gallery-item');
        this.currentIndex = 0;
        this.images = [];
        this.lightboxTitle = null; // Will be created when lightbox opens
        
        this.init();
    }
    
    init() {
        this.collectImages();
        this.bindEvents();
        this.setupTouchEvents();
    }
    
    collectImages() {
        this.galleryItems.forEach((item, index) => {
            const fullImage = item.getAttribute('data-full');
            const title = item.getAttribute('data-title') || '';
            
            // Store both image source and title for quick access
            this.images.push({
                src: fullImage,
                title: Gallery.cleanFilenameToTitle(title)
            });
            
            item.addEventListener('click', () => {
                this.openLightbox(index);
            });
        });
    }
    
    bindEvents() {
        // Close lightbox when clicking outside image
        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox || e.target.classList.contains('lightbox-content')) {
                this.closeLightbox();
            }
        });
        
        // Image click navigation
        this.lightboxImage.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = this.lightboxImage.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            clickX < rect.width / 2 ? this.showPrevious() : this.showNext();
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.lightbox.classList.contains('active')) return;
            
            switch(e.key) {
                case 'Escape':
                    this.closeLightbox();
                    break;
                case 'ArrowLeft':
                    this.showPrevious();
                    break;
                case 'ArrowRight':
                    this.showNext();
                    break;
            }
        });
        
        // Window resize handler
        window.addEventListener('resize', () => {
            if (this.lightbox.classList.contains('active')) {
                this.scaleImage();
            }
        });
    }
    
    setupTouchEvents() {
let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;
let startTouches = 0;
let initialDistance = 0;
let initialScale = 1;
let scale = 1;
let isPinching = false;
let hasMoved = false;
let touchStartTime = 0;
        
        this.lightbox.addEventListener('touchstart', (e) => {
            startTouches = e.touches.length;
            touchStartTime = Date.now();
            
if (startTouches === 1) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    hasMoved = false;
    isPinching = false;
} else if (startTouches === 2) {
    // Pinch-to-zoom initialization
    initialDistance = getDistance(e.touches);
    initialScale = scale;
    isPinching = true;
    // Prevent default browser zoom behavior
    e.preventDefault();
}
        });
        
        this.lightbox.addEventListener('touchmove', (e) => {
if (startTouches === 2 && e.touches.length === 2 && isPinching) {
    // Handle pinch zoom
    e.preventDefault();
    const newDistance = getDistance(e.touches);
    scale = initialScale * (newDistance / initialDistance);
    this.lightboxImage.style.transform = `scale(${scale})`;
    return;
}
            
            if (startTouches === 1 && e.touches.length === 1) {
                const currentX = e.touches[0].clientX;
                const currentY = e.touches[0].clientY;
                const moveDistance = Math.sqrt(
                    Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
                );
                
                if (moveDistance > 10) {
                    hasMoved = true;
                }
            }
        });
        
        this.lightbox.addEventListener('touchend', (e) => {
// If the gesture started as multi-touch (pinch) or detected as pinching, handle end of pinch
if (startTouches >= 2 || isPinching) {
    // Persist the final scale
    initialScale = scale;
    isPinching = false;
    return;
}
            
            // Only process single-touch gestures
            if (startTouches === 1 && e.changedTouches.length === 1) {
                endX = e.changedTouches[0].clientX;
                endY = e.changedTouches[0].clientY;
                
                const deltaX = endX - startX;
                const deltaY = endY - startY;
                const touchDuration = Date.now() - touchStartTime;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // Distinguish between tap and swipe based on movement and duration
                const isQuickTap = touchDuration < 300 && distance < 20;
                
                if (isQuickTap) {
                    // Handle tap
                    const target = e.target;
                    if (target === this.lightbox || target.classList.contains('lightbox-content')) {
                        // Tap outside image - close lightbox
                        this.closeLightbox();
                    } else if (target === this.lightboxImage || target.closest('#lightbox-image')) {
                        // Tap on image - navigate
                        const rect = this.lightboxImage.getBoundingClientRect();
                        const tapX = endX - rect.left;
                        tapX < rect.width / 2 ? this.showPrevious() : this.showNext();
                    }
                } else if (hasMoved && distance > 80) {
                    // Handle swipe (increased threshold for more deliberate gestures)
                    const minSwipeDistance = 80;
                    
                    // Horizontal swipe
                    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                        if (deltaX > 0) {
                            this.showPrevious(); // Swipe right
                        } else {
                            this.showNext(); // Swipe left
                        }
                    }
                    // Vertical swipe down
                    else if (deltaY > minSwipeDistance && Math.abs(deltaY) > Math.abs(deltaX)) {
                        this.closeLightbox(); // Swipe down
                    }
                    // Vertical swipe up
                    else if (deltaY < -minSwipeDistance && Math.abs(deltaY) > Math.abs(deltaX)) {
                        this.closeLightbox(); // Swipe up
                    }
                }
            }
        });
        
        // Utility function to calculate distance between two touch points
        function getDistance(touches) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }
    }
    
    openLightbox(index) {
        this.currentIndex = index;
        this.lightboxImage.src = this.images[index].src;
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Create or update title element
        this.createOrUpdateTitle();
        
        // Smart scaling for images
        this.scaleImage();
        
        // Preload adjacent images
        this.preloadAdjacentImages();
    }
    
    closeLightbox() {
        this.lightbox.classList.remove('active');
        document.body.style.overflow = '';
        // Reset transform when closing lightbox
        this.lightboxImage.style.transform = 'scale(1)';
    }
    
    showPrevious() {
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.images.length - 1;
        this.lightboxImage.src = this.images[this.currentIndex].src;
        
        // Update title for new image
        this.updateTitle();
        
        // Smart scaling for images
        this.scaleImage();
        
        this.preloadAdjacentImages();
    }
    
    showNext() {
        this.currentIndex = this.currentIndex < this.images.length - 1 ? this.currentIndex + 1 : 0;
        this.lightboxImage.src = this.images[this.currentIndex].src;
        
        // Update title for new image
        this.updateTitle();
        
        // Smart scaling for images
        this.scaleImage();
        
        this.preloadAdjacentImages();
    }
    
    scaleImage() {
        // Reset styles and transform first
        this.lightboxImage.style.maxWidth = '100%';
        this.lightboxImage.style.maxHeight = '100%';
        this.lightboxImage.style.width = 'auto';
        this.lightboxImage.style.height = 'auto';
        this.lightboxImage.style.transform = 'scale(1)';
        
        // Wait for image to load and then apply smart scaling
        this.lightboxImage.onload = () => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = 32; // Минимальный отступ только сверху и снизу (1rem * 2)
            
            const maxWidth = viewportWidth; // Используем всю ширину
            const maxHeight = viewportHeight - padding;
            
            // Apply constraints to ensure image fits in viewport
            this.lightboxImage.style.maxWidth = `${maxWidth}px`;
            this.lightboxImage.style.maxHeight = `${maxHeight}px`;
        };
    }
    
    preloadAdjacentImages() {
        const preloadIndices = [
            this.currentIndex - 1 >= 0 ? this.currentIndex - 1 : this.images.length - 1,
            this.currentIndex + 1 < this.images.length ? this.currentIndex + 1 : 0
        ];
        
        preloadIndices.forEach(index => {
            const img = new Image();
            img.src = this.images[index].src;
        });
    }
    
    /**
     * Creates the title element if it doesn't exist, or updates it if it does
     */
    createOrUpdateTitle() {
        if (!this.lightboxTitle) {
            // Create the title element
            this.lightboxTitle = document.createElement('div');
            this.lightboxTitle.className = 'lightbox-title';
            
            // Insert it after the image container in the lightbox-content
            const lightboxContent = this.lightbox.querySelector('.lightbox-content');
            lightboxContent.appendChild(this.lightboxTitle);
        }
        
        // Update the title text
        this.updateTitle();
    }
    
    /**
     * Updates the title text based on the current image
     */
    updateTitle() {
        if (this.lightboxTitle) {
            // Use the pre-cleaned title from the slides array for quick access
            const currentImage = this.images[this.currentIndex];
            this.lightboxTitle.textContent = currentImage.title;
        }
    }
    
    /**
     * Extracts filename from URL
     * @param {string} url - The image URL
     * @returns {string} - The filename
     */
    extractFilenameFromUrl(url) {
        if (!url) return '';
        // Handle URL-encoded characters and extract filename
        const decodedUrl = decodeURIComponent(url);
        const parts = decodedUrl.split('/');
        return parts[parts.length - 1] || '';
    }
    
    /**
     * Utility function to clean filenames into human-readable titles
     * @param {string} filename - The filename to clean
     * @returns {string} - The cleaned, human-readable title
     */
    static cleanFilenameToTitle(filename) {
        if (!filename) return '';
        
        let title = filename;
        
        // Remove /images/ prefix from the path
        title = title.replace(/^\/?images\//i, '');
        
        // Remove file extension (.jpg, .JPG, etc.)
        title = title.replace(/\.\w+$/, '');
        
        // Remove size patterns like '90х110', '74х64' at the end
        title = title.replace(/\s+\d+х\d+$/i, '');
        
        // Remove underscores and replace with spaces
        title = title.replace(/_/g, ' ');
        
        // Remove LIS prefix (after underscores converted to spaces)
        title = title.replace(/^LIS\s+/i, '');
        
        // Clean up extra whitespace
        title = title.replace(/\s+/g, ' ').trim();
        
        return title;
    }
}

// Initialize gallery when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Gallery();
});

// Add loading animation and masonry enhancement
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('.gallery-item img');
    const container = document.querySelector('.gallery-container');
    
    // Enhanced masonry layout
    function initMasonry() {
        if (window.innerWidth > 768) {
            // For desktop, ensure proper column breaks
            const items = document.querySelectorAll('.gallery-item');
            items.forEach(item => {
                item.style.breakInside = 'avoid';
                item.style.pageBreakInside = 'avoid';
            });
        }
    }
    
    // Initialize masonry
    initMasonry();
    
    // Re-initialize on window resize
    window.addEventListener('resize', initMasonry);
    
    // Image loading
    images.forEach(img => {
        img.addEventListener('load', () => {
            img.style.opacity = '1';
            // Trigger masonry recalculation after image load
            setTimeout(() => {
                initMasonry();
            }, 10);
        });
    });
});
