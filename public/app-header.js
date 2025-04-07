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
        const userString = localStorage.getItem('user'); // Use 'user' key
        const user = userString ? JSON.parse(userString) : null; // Parse the stored string
        console.log("app-header: checkAuthStatus - User from localStorage:", user);
        
        // If no user is found in localStorage, redirect to login page
        if (!user) {
            console.log("app-header: No user in localStorage, redirecting to login.html");
            window.location.href = '/login.html';
            return; // Stop execution
        }
        
        // If user exists locally, verify with server to ensure session is still valid
        console.log("app-header: User found locally, verifying with server...");
        fetch('/api/auth/verify', {
            method: 'GET',
            credentials: 'include' // Send cookies
        })
        .then(response => {
             console.log("app-header: /api/auth/verify response status:", response.status);
             if (!response.ok) {
                 // Handle non-200 responses gracefully before trying to parse JSON
                 throw new Error(`Verification failed with status: ${response.status}`);
             }
             return response.json();
         })
        .then(data => {
             console.log("app-header: /api/auth/verify response data:", data);
            if (!data.loggedIn) { // Check 'loggedIn' property
                // If not authenticated server-side, clear local user and redirect
                console.log("app-header: Server verification failed, clearing user and redirecting to login.html");
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            } else {
                // Server confirms user is logged in. Update header.
                // Use the potentially updated user data from the verify response
                 console.log("app-header: Server verification successful. Updating header.");
                updateUserInfo(data.user || user); 
                // Store potentially updated user data back in localStorage
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
            }
        })
        .catch(error => {
            console.error('app-header: Authentication verification error:', error);
            // Optional: Decide if redirect should happen on network error
            // For now, we allow the app to load using local data, might be stale.
             console.log("app-header: Verification error, proceeding with potentially stale local user data.");
             updateUserInfo(user); // Update header with local data on error
        });
    }
    
    // Update user info in header
    function updateUserInfo(user) {
        // Check if running in shadow DOM context (Web Component)
        const root = this.shadowRoot || document; // Use shadowRoot if available, else document

        const userNameElement = root.getElementById('user-name') || root.querySelector('.user-name'); // Try ID then class
        const accountMenu = root.getElementById('account-menu') || root.querySelector('.user-dropdown');
        const loginButton = root.getElementById('login-button') || root.querySelector('.login-button'); // Try ID then class

        if (user) {
            if (userNameElement) userNameElement.textContent = user.name || user.email || 'My Account';
            if (accountMenu) accountMenu.style.display = 'block';
            if (loginButton) loginButton.style.display = 'none';

            // Update dropdown links
            const profileLink = root.getElementById('profile-link');
            const settingsLink = root.getElementById('settings-link');
            const companyLink = root.getElementById('company-link');
            const subscriptionLink = root.getElementById('subscription-link');

            if(profileLink) profileLink.href = 'user.html#profile';
            if(settingsLink) settingsLink.href = 'user.html#profile'; 
            if(companyLink) companyLink.href = 'user.html#profile';
            if(subscriptionLink) subscriptionLink.href = 'user.html#billing';

        } else {
            if (userNameElement) userNameElement.textContent = '';
            if (accountMenu) accountMenu.style.display = 'none';
            if (loginButton) loginButton.style.display = 'inline-block';
        }
    }
    
    // Logout function needs to clear 'user' key
    async function logout() { // Assuming this is called by an event listener
        console.log('Logging out...');
        try {
            await fetch('/api/auth/logout', { 
                method: 'POST', 
                credentials: 'include' 
            });
        } catch (error) {
            console.error('Server logout failed:', error);
            // Proceed with client-side cleanup anyway
        } finally {
            localStorage.removeItem('user');  // Clear the 'user' key
            localStorage.removeItem('userToken'); // Clear the old key too just in case
            updateUserInfo(null);
            console.log('Client-side logout complete, redirecting to login.html');
            window.location.href = '/login.html'; 
        }
    }

    // Ensure logout button listener calls the new logout function
    const logoutLink = this.shadowRoot?.getElementById('logout-link') || document.getElementById('logout-link'); // Find logout link/button
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
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