document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('nav ul li a, .footer-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Only apply to hash links that point to an element on this page
            if (this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80, // Offset for fixed header
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Header scroll effect
    const header = document.querySelector('.main-header');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    
    // Form submission handling
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;
            
            // Here you would normally send this data to your server
            // For demo purposes, we'll just log it and show a success message
            console.log('Form submitted:', { name, email, subject, message });
            
            // Show success message
            contactForm.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <h3>Thank you for your message!</h3>
                    <p>We've received your inquiry and will get back to you shortly.</p>
                </div>
            `;
        });
    }
    
    // Newsletter form submission
    const newsletterForm = document.querySelector('.newsletter-form');
    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = newsletterForm.querySelector('input[type="email"]').value;
            
            // Here you would normally send this data to your server
            console.log('Newsletter subscription:', email);
            
            // Show success message
            const button = newsletterForm.querySelector('button');
            button.innerHTML = 'Subscribed!';
            button.classList.add('subscribed');
            
            // Reset after a delay
            setTimeout(() => {
                newsletterForm.reset();
                button.innerHTML = 'Subscribe';
                button.classList.remove('subscribed');
            }, 3000);
        });
    }
    
    // Animation on scroll
    const animateElements = document.querySelectorAll('.feature-card, .pricing-card, .testimonial-card');
    
    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                    // Unobserve after animation
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });
        
        animateElements.forEach(element => {
            observer.observe(element);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        animateElements.forEach(element => {
            element.classList.add('animate');
        });
    }
    
    // Create images directory if it doesn't exist
    function checkAndCreateImagesDirectory() {
        const logoImg = document.querySelector('.logo img');
        const heroImg = document.querySelector('.hero-image img');
        
        // Set default fallback images if the images don't load
        logoImg.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzRhNmJmYSIvPgo8cGF0aCBkPSJNMTAgMTBIMzBWMzBIMTBWMTBaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTE1IDE1SDI1VjI1SDE1VjE1WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
        };
        
        heroImg.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDUwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzAwIiByeD0iOCIgZmlsbD0iI2YzZjRmNiIvPgo8cmVjdCB4PSIxNTAiIHk9IjEwMCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIHJ4PSI0IiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik0yMDAgMTMwSDMwMCIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTIwMCAxNTBIMjgwIiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMjAwIDE3MEgyNjAiIHN0cm9rZT0iIzljYTNhZiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPg==';
        };
        
        // Same for testimonial images
        const testimonialImages = document.querySelectorAll('.testimonial-author img');
        testimonialImages.forEach(img => {
            img.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiNlNWU3ZWIiLz4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyMCIgcj0iOCIgZmlsbD0iI2QxZDVkYiIvPgo8cGF0aCBkPSJNMTUgMzVDMTUgMzAgMjAgMjcuNSAyNSAyNy41QzMwIDI3LjUgMzUgMzAgMzUgMzVDMzUgNDAgMzAgNDAgMjUgNDBDMjAgNDAgMTUgNDAgMTUgMzVaIiBmaWxsPSIjZDFkNWRiIi8+Cjwvc3ZnPg==';
            };
        });
    }
    
    checkAndCreateImagesDirectory();
}); 