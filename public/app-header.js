document.addEventListener('DOMContentLoaded', function() {
    // Handle user dropdown functionality
    const userDropdown = document.querySelector('.user-dropdown');
    const userDropdownToggle = document.querySelector('.user-dropdown-toggle');
    
    if (userDropdownToggle) {
        userDropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }
    
    // Mobile sidebar toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-visible');
        });
    }
    
    // Handle logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show confirmation dialog
            if (confirm('Are you sure you want to log out?')) {
                // Send logout request to the server
                fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    // Clear local storage
                    localStorage.removeItem('user');
                    
                    // Redirect to login page
                    window.location.href = '/login.html';
                })
                .catch(error => {
                    console.error('Logout error:', error);
                    // Still redirect to login page even if there's an error
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                });
            }
        });
    }
    
    // Support button functionality
    const supportBtn = document.getElementById('contact-support');
    
    if (supportBtn) {
        supportBtn.addEventListener('click', function() {
            // Show support modal or redirect to support page
            alert('Support functionality would be implemented here. For now, please email support@menubuilder.pro');
        });
    }
    
    // Check authentication status
    function checkAuthStatus() {
        // Get user from localStorage
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        // If no user is found in localStorage, redirect to login page
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        
        // If user exists, verify with server
        fetch('/api/auth/verify', {
            method: 'GET',
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (!data.authenticated) {
                // If not authenticated, redirect to login page
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            } else {
                // Update user name in the header
                updateUserInfo(data.user || user);
            }
        })
        .catch(error => {
            console.error('Authentication error:', error);
            // Don't redirect on error to prevent issues with offline usage
        });
    }
    
    // Update user info in header
    function updateUserInfo(user) {
        const userNameElement = document.querySelector('.user-name');
        
        if (userNameElement && user) {
            // Display user's name or email
            userNameElement.textContent = user.name || user.email || 'My Account';
        }
    }
    
    // Initialize
    checkAuthStatus();
    
    // Load user profile image if available
    function loadUserProfileImage() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const userAvatar = document.querySelector('.user-avatar');
        
        if (user && user.profileImage && userAvatar) {
            // Replace icon with image
            userAvatar.innerHTML = `<img src="${user.profileImage}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
    }
    
    loadUserProfileImage();
}); 