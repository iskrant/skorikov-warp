class Gallery {
    constructor() {
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImage = document.getElementById('lightbox-image');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.galleryItems = document.querySelectorAll('.gallery-item');
        this.currentIndex = 0;
        this.images = [];
        
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
            this.images.push(fullImage);
            
            item.addEventListener('click', () => {
                this.openLightbox(index);
            });
        });
    }
    
    bindEvents() {
        // Close lightbox when clicking outside image
        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) {
                this.closeLightbox();
            }
        });
        
        // Navigation buttons
        this.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPrevious();
        });
        
        this.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showNext();
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
    }
    
    setupTouchEvents() {
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        
        this.lightbox.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        this.lightbox.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const minSwipeDistance = 50;
            
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
        });
    }
    
    openLightbox(index) {
        this.currentIndex = index;
        this.lightboxImage.src = this.images[index];
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Preload adjacent images
        this.preloadAdjacentImages();
    }
    
    closeLightbox() {
        this.lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    showPrevious() {
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.images.length - 1;
        this.lightboxImage.src = this.images[this.currentIndex];
        this.preloadAdjacentImages();
    }
    
    showNext() {
        this.currentIndex = this.currentIndex < this.images.length - 1 ? this.currentIndex + 1 : 0;
        this.lightboxImage.src = this.images[this.currentIndex];
        this.preloadAdjacentImages();
    }
    
    preloadAdjacentImages() {
        const preloadIndices = [
            this.currentIndex - 1 >= 0 ? this.currentIndex - 1 : this.images.length - 1,
            this.currentIndex + 1 < this.images.length ? this.currentIndex + 1 : 0
        ];
        
        preloadIndices.forEach(index => {
            const img = new Image();
            img.src = this.images[index];
        });
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
