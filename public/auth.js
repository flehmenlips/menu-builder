document.addEventListener('DOMContentLoaded', function() {
    // Get the forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Clear previous errors
            const errorElement = document.getElementById('loginError');
            errorElement.style.display = 'none';
            errorElement.textContent = '';
            
            // Get form values
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember')?.checked || false;
            
            // Simple validation
            if (!email || !password) {
                showError(errorElement, 'Please enter both email and password.');
                return;
            }
            
            // Email validation
            if (!isValidEmail(email)) {
                showError(errorElement, 'Please enter a valid email address.');
                return;
            }
            
            // Show loading state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Logging in...';
            submitButton.disabled = true;
            
            // Make API call to login
            fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, remember }),
                credentials: 'include' // Important for cookies
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // DEBUG: Log the structure of the login response
                console.log('Login API Response Data:', JSON.stringify(data, null, 2));

                // Successful login
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect to dashboard
                window.location.href = '/menu-builder';
            })
            .catch(error => {
                // Show error message
                showError(errorElement, error.message || 'Login failed. Please check your credentials and try again.');
                
                // Reset button
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            });
        });
    }
    
    // Handle registration form submission
    if (registerForm) {
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        // Password strength checker
        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                updatePasswordStrength(this.value);
            });
        }
        
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Clear previous errors
            const errorElement = document.getElementById('registerError');
            errorElement.style.display = 'none';
            errorElement.textContent = '';
            
            // Get form values
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const termsAccepted = document.getElementById('terms')?.checked || false;
            
            // Simple validation
            if (!name || !email || !password || !confirmPassword) {
                showError(errorElement, 'Please fill in all fields.');
                return;
            }
            
            // Email validation
            if (!isValidEmail(email)) {
                showError(errorElement, 'Please enter a valid email address.');
                return;
            }
            
            // Password validation
            if (password.length < 8) {
                showError(errorElement, 'Password must be at least 8 characters long.');
                return;
            }
            
            // Password match validation
            if (password !== confirmPassword) {
                showError(errorElement, 'Passwords do not match.');
                return;
            }
            
            // Terms validation
            if (!termsAccepted) {
                showError(errorElement, 'You must agree to the Terms of Service and Privacy Policy.');
                return;
            }
            
            // Get plan from URL if present
            const urlParams = new URLSearchParams(window.location.search);
            const plan = urlParams.get('plan') || 'free';
            
            // Show loading state
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Creating Account...';
            submitButton.disabled = true;
            
            // Make API call to register
            fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password, plan }),
                credentials: 'include' // Important for cookies
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Successful registration
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect to dashboard or onboarding
                window.location.href = data.redirect || '/menu-builder';
            })
            .catch(error => {
                // Show error message
                showError(errorElement, error.message || 'Registration failed. Please try again.');
                
                // Reset button
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            });
        });
    }
    
    // Google auth handler
    const googleButtons = document.querySelectorAll('.btn-google');
    googleButtons.forEach(button => {
        button.addEventListener('click', function() {
            // In a real implementation, this would redirect to your Google OAuth endpoint
            alert('Google authentication would be implemented here.');
            
            // Example redirect to your OAuth endpoint
            // window.location.href = '/api/auth/google';
        });
    });
    
    // Check if user is already logged in
    function checkAuthStatus() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (user) {
            // Check if the session is still valid with the server
            fetch('/api/auth/verify', {
                method: 'GET',
                credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    // Redirect to dashboard if on login/register page
                    if (window.location.pathname === '/login.html' || window.location.pathname === '/register.html') {
                        window.location.href = '/menu-builder';
                    }
                } else {
                    // If session is invalid, clear local storage
                    localStorage.removeItem('user');
                }
            })
            .catch(() => {
                // On error, clear local storage
                localStorage.removeItem('user');
            });
        }
    }
    
    // Helper functions
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }
    
    function isValidEmail(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    }
    
    function updatePasswordStrength(password) {
        const strengthMeter = document.querySelector('.strength-meter-fill');
        const strengthText = document.querySelector('.strength-text span');
        
        if (!strengthMeter || !strengthText) return;
        
        let strength = 0;
        let feedback = 'weak';
        
        // Criteria: Length
        if (password.length >= 8) strength += 25;
        
        // Criteria: Has lowercase and uppercase
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        
        // Criteria: Has numbers
        if (/\d/.test(password)) strength += 25;
        
        // Criteria: Has special characters
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;
        
        // Update meter width
        strengthMeter.style.width = `${strength}%`;
        
        // Update text and color
        if (strength <= 25) {
            strengthMeter.style.backgroundColor = '#ef4444'; // Red
            feedback = 'weak';
        } else if (strength <= 50) {
            strengthMeter.style.backgroundColor = '#f97316'; // Orange
            feedback = 'fair';
        } else if (strength <= 75) {
            strengthMeter.style.backgroundColor = '#f59e0b'; // Amber
            feedback = 'good';
        } else {
            strengthMeter.style.backgroundColor = '#34d399'; // Green
            feedback = 'strong';
        }
        
        strengthText.textContent = feedback;
    }
    
    // Initialize page
    checkAuthStatus();
    
    // Check for URL params
    const urlParams = new URLSearchParams(window.location.search);
    const loginError = urlParams.get('error');
    
    if (loginError) {
        const errorElement = document.getElementById('loginError') || document.getElementById('registerError');
        if (errorElement) {
            showError(errorElement, decodeURIComponent(loginError));
        }
    }
    
    // Handle fallback images for auth pages
    function setupImageFallbacks() {
        // Logo image fallback
        const logoImg = document.querySelector('.logo img');
        if (logoImg) {
            logoImg.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzRhNmJmYSIvPgo8cGF0aCBkPSJNMTAgMTBIMzBWMzBIMTBWMTBaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTE1IDE1SDI1VjI1SDE1VjE1WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
            };
        }
        
        // Auth feature image fallback
        const authImg = document.querySelector('.auth-image img');
        if (authImg) {
            authImg.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDUwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzAwIiByeD0iOCIgZmlsbD0iI2YzZjRmNiIvPgo8cmVjdCB4PSIxNTAiIHk9IjEwMCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIHJ4PSI0IiBmaWxsPSIjZTVlN2ViIi8+CjxwYXRoIGQ9Ik0yMDAgMTMwSDMwMCIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTIwMCAxNTBIMjgwIiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMjAwIDE3MEgyNjAiIHN0cm9rZT0iIzljYTNhZiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPg==';
            };
        }
    }
    
    setupImageFallbacks();
}); 