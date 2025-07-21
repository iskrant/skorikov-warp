// Debug flag - set to true to enable touch event debugging
const JS_DEBUG = true;

class Gallery {
    constructor() {
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImage = document.getElementById('lightbox-image');
        this.galleryItems = document.querySelectorAll('.gallery-item');
        this.currentIndex = 0;
        this.images = [];
        this.lightboxTitle = null; // Will be created when lightbox opens

        // Touch/zoom state variables
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.mode = 'swipe'; // Режим touch-жестов: 'swipe', 'pan', 'pinch'

        this.init();
    }

    debug(message, ...args) {
        if (JS_DEBUG) {
            console.log(`[Gallery Debug] ${message}`, ...args);
        }
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

    isZoomed() {
        return this.scale > 1;
    }

    bindEvents() {
        // Close lightbox when clicking outside image
        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox || e.target.classList.contains('lightbox-content')) {
                this.closeLightbox();
            }
        });

        // Comprehensive mobile touch event blocking
        this.setupMobileTouchBlocking();

        // Prevent event propagation on lightbox to stop mobile touch passthrough
        this.lightbox.addEventListener('touchstart', (e) => {
            if (e.target === this.lightbox || e.target.classList.contains('lightbox-content')) {
                e.stopPropagation();
            }
        }, { passive: false });

        this.lightbox.addEventListener('touchend', (e) => {
            if (e.target === this.lightbox || e.target.classList.contains('lightbox-content')) {
                e.stopPropagation();
            }
        }, { passive: false });

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

    setupMobileTouchBlocking() {
        // Block all touch events on gallery items when lightbox is active
        const blockTouchEvent = (e) => {
            if (document.body.classList.contains('lightbox-active')) {
                const target = e.target;
                const galleryItem = target.closest('.gallery-item');
                const galleryContainer = target.closest('.gallery-container');

                // Block events on gallery items and container
                if (galleryItem || galleryContainer) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }
        };

        // Add event listeners for all touch events
        ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(eventType => {
            document.addEventListener(eventType, blockTouchEvent, {
                passive: false,
                capture: true
            });
        });

        // Also block click events on mobile
        document.addEventListener('click', (e) => {
            if (document.body.classList.contains('lightbox-active')) {
                const target = e.target;
                const galleryItem = target.closest('.gallery-item');
                const galleryContainer = target.closest('.gallery-container');

                // Block clicks on gallery items and container
                if (galleryItem || galleryContainer) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }
        }, {
            passive: false,
            capture: true
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
        let isPinching = false;
        let hasMoved = false;
        let touchStartTime = 0;
        let lastPanX = 0;
        let lastPanY = 0;
        let isPanning = false;

        this.lightbox.addEventListener('touchstart', (e) => {
            startTouches = e.touches.length;
            touchStartTime = Date.now();
            isPanning = false;
            isPinching = false;

            this.debug('TouchStart:', {
                touches: startTouches,
                scale: this.scale,
                currentMode: this.mode
            });

            // Правильное переключение режимов
            if (startTouches === 1) {
                this.mode = this.scale > 1 ? 'pan' : 'swipe';
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                hasMoved = false;

                this.debug('TouchStart - Single finger:', {
                    newMode: this.mode,
                    startX: startX,
                    startY: startY,
                    scale: this.scale
                });
            } else if (startTouches === 2) {
                // Pinch-to-zoom initialization
                this.mode = 'pinch';
                initialDistance = getDistance(e.touches);
                initialScale = this.scale;
                isPinching = true;
                // Prevent default browser zoom behavior only for two-finger touches
                e.preventDefault();

                this.debug('TouchStart - Pinch mode:', {
                    initialDistance: initialDistance,
                    initialScale: initialScale
                });
            }
        }, { passive: false });

        this.lightbox.addEventListener('touchmove', (e) => {
            // Handle pinch-to-zoom FIRST, regardless of mode
            if (startTouches === 2 && e.touches.length === 2 && isPinching) {
                // Handle pinch zoom - works in both pan and swipe modes
                e.preventDefault();
                const newDistance = getDistance(e.touches);
                this.scale = initialScale * (newDistance / initialDistance);
                // Нормализация масштаба в диапазоне 0.5-3
                this.scale = Math.min(3, Math.max(0.5, this.scale));
                this.lightboxImage.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
                return;
            }

            if (this.mode === 'pan') {
                // Always preventDefault in pan mode for single-finger gestures
                e.preventDefault();

                if (startTouches === 1 && e.touches.length === 1) {
                    // Handle single-finger pan
                    const currentX = e.touches[0].clientX;
                    const currentY = e.touches[0].clientY;
                    this.panX = lastPanX + (currentX - startX);
                    this.panY = lastPanY + (currentY - startY);
                    this.lightboxImage.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
                    isPanning = true;
                }
                return;
            }

            if (this.mode === 'swipe') {
                // Handle swipe mode - only track movement for threshold detection
                if (startTouches === 1 && e.touches.length === 1) {
                    const currentX = e.touches[0].clientX;
                    const currentY = e.touches[0].clientY;
                    const moveDistance = Math.sqrt(
                        Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
                    );

                    // In swipe mode (scale <= 1), we DON'T set isPanning = true
                    // because we want to allow swipe detection in touchend
                    // isPanning should only be true for actual pan operations when zoomed

                    // Only mark as moved if exceeds swipe threshold
                    if (moveDistance > 10) {
                        hasMoved = true;
                        this.debug('TouchMove - Swipe movement detected:', {
                            moveDistance: moveDistance,
                            hasMoved: hasMoved
                        });
                    }
                }
                // Do NOT modify panX/panY in swipe mode
                // Do NOT set isPanning in swipe mode
            }
        }, { passive: false });

        this.lightbox.addEventListener('touchend', (e) => {
            this.debug('TouchEnd:', {
                mode: this.mode,
                scale: this.scale,
                startTouches: startTouches,
                isPanning: isPanning,
                isPinching: isPinching,
                hasMoved: hasMoved
            });

            if (this.mode === 'pan') {
                // Finish panning: store lastPanX/Y, keep scale; DO NOT enter swipe code.
                lastPanX = this.panX;
                lastPanY = this.panY;
                this.debug('TouchEnd - Pan mode finished');
                return;
            }

// If the gesture started as multi-touch (pinch) or detected as pinching, handle end of pinch
if (startTouches >= 2 || isPinching) {
    // Нормализация масштаба при завершении pinch
    this.scale = Math.min(3, Math.max(0.5, this.scale));
    // Persist the final scale and pan position
    initialScale = this.scale;
    lastPanX = this.panX;
    lastPanY = this.panY;
    isPinching = false;
    this.debug('TouchEnd - Pinch finished, final scale:', this.scale);
    return;
}

// Handle end of panning
if (isPanning) {
    lastPanX = this.panX;
    lastPanY = this.panY;
    isPanning = false;
    this.debug('TouchEnd - Panning finished');
    return;
}

            // Only process swipe gestures when scale <= 1 AND if not panning
            // При scale > 1 режим pan блокирует свайп-навигацию
            const canSwipe = startTouches === 1 && e.changedTouches.length === 1 && !isPanning && this.scale <= 1;

            this.debug('TouchEnd - Swipe check:', {
                startTouches: startTouches,
                changedTouches: e.changedTouches.length,
                isPanning: isPanning,
                scale: this.scale,
                canSwipe: canSwipe
            });

            if (canSwipe) {
                endX = e.changedTouches[0].clientX;
                endY = e.changedTouches[0].clientY;

                const deltaX = endX - startX;
                const deltaY = endY - startY;
                const touchDuration = Date.now() - touchStartTime;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // Distinguish between tap and swipe based on movement and duration
                const isQuickTap = touchDuration < 300 && distance < 20;

                this.debug('TouchEnd - Gesture analysis:', {
                    deltaX: deltaX,
                    deltaY: deltaY,
                    distance: distance,
                    duration: touchDuration,
                    isQuickTap: isQuickTap,
                    hasMoved: hasMoved
                });

                if (isQuickTap) {
                    // Handle tap
                    const target = e.target;
                    this.debug('TouchEnd - Quick tap detected, target:', target.tagName);

                    if (target === this.lightbox || target.classList.contains('lightbox-content')) {
                        // Tap outside image - close lightbox
                        this.debug('TouchEnd - Tap outside image, closing lightbox');
                        this.closeLightbox();
                    } else if (target === this.lightboxImage || target.closest('#lightbox-image')) {
                        // Tap on image - navigate
                        const rect = this.lightboxImage.getBoundingClientRect();
                        const tapX = endX - rect.left;
                        const direction = tapX < rect.width / 2 ? 'previous' : 'next';
                        this.debug('TouchEnd - Tap on image, navigating:', direction);

                        tapX < rect.width / 2 ? this.showPrevious() : this.showNext();
                    }
                } else if (hasMoved && distance > 80) {
                    // Handle swipe (increased threshold for more deliberate gestures)
                    const minSwipeDistance = 80;

                    this.debug('TouchEnd - Swipe detected, analyzing direction...');

                    // Horizontal swipe
                    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                        if (deltaX > 0) {
                            this.debug('TouchEnd - Horizontal swipe RIGHT, going to previous');
                            this.showPrevious(); // Swipe right
                        } else {
                            this.debug('TouchEnd - Horizontal swipe LEFT, going to next');
                            this.showNext(); // Swipe left
                        }
                    }
                    // Vertical swipe down
                    else if (deltaY > minSwipeDistance && Math.abs(deltaY) > Math.abs(deltaX)) {
                        this.debug('TouchEnd - Vertical swipe DOWN, closing lightbox');
                        this.closeLightbox(); // Swipe down
                    }
                    // Vertical swipe up
                    else if (deltaY < -minSwipeDistance && Math.abs(deltaY) > Math.abs(deltaX)) {
                        this.debug('TouchEnd - Vertical swipe UP, closing lightbox');
                        this.closeLightbox(); // Swipe up
                    } else {
                        this.debug('TouchEnd - Swipe detected but no direction matched', {
                            absDeltaX: Math.abs(deltaX),
                            absDeltaY: Math.abs(deltaY),
                            minSwipeDistance: minSwipeDistance
                        });
                    }
                } else {
                    this.debug('TouchEnd - No gesture detected', {
                        hasMoved: hasMoved,
                        distance: distance,
                        threshold: 80
                    });
                }
            } else {
                this.debug('TouchEnd - Swipe conditions not met, ignoring gesture');
            }
        }, { passive: false });

// Apply conditions to ensure navigation works correctly at different scales
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
        document.body.classList.add('lightbox-active'); // Disable gallery interactions

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
        document.body.classList.remove('lightbox-active'); // Re-enable gallery interactions
        // Reset transform when closing lightbox
        this.lightboxImage.style.transform = 'scale(1)';
        // Reset zoom and pan state
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        // Clear mode to ensure next open starts in normal mode
        this.mode = 'swipe';
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

        // Reset zoom and pan state
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;

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

// version 20.07.2025 15:00 - Added comprehensive touch debug logging
