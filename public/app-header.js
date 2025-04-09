// Define API Base URL (Replace with process.env in build step or config later)
const API_BASE_URL = '/api'; 

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
                fetch(`${API_BASE_URL}/auth/logout`, {
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
        fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'GET',
            credentials: 'include' // Send cookies
        })
        .then(response => {
             console.log("app-header: /auth/verify response status:", response.status);
             if (!response.ok) {
                 // Handle non-200 responses gracefully before trying to parse JSON
                 throw new Error(`Verification failed with status: ${response.status}`);
             }
             return response.json();
         })
        .then(data => {
             console.log("app-header: /auth/verify response data:", data);
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
        console.log('[updateUserInfo] Received user:', user); // DEBUGGING
        // Check if running in shadow DOM context (Web Component)
        const root = this.shadowRoot || document; // Use shadowRoot if available, else document

        const userNameElement = root.getElementById('user-name') || root.querySelector('.user-name'); // Try ID then class
        const accountMenu = root.getElementById('account-menu') || root.querySelector('.user-dropdown');
        const loginButton = root.getElementById('login-button') || root.querySelector('.login-button'); // Try ID then class
        const dropdownUl = root.querySelector('.user-dropdown ul'); // Target the list within the dropdown
        console.log('[updateUserInfo] Found dropdownUl:', dropdownUl); // DEBUGGING

        // --- START: Remove existing dynamic items --- 
        const existingAdminLi = root.querySelector('#admin-link-li');
        const existingAdminIndicatorLi = root.querySelector('#admin-indicator-li');
        if (existingAdminLi) {
            const precedingSeparator = existingAdminLi.previousElementSibling;
            if (precedingSeparator && precedingSeparator.tagName === 'LI' && precedingSeparator.querySelector('hr')) {
                precedingSeparator.remove();
            }
            existingAdminLi.remove();
        }
        if (existingAdminIndicatorLi) {
             existingAdminIndicatorLi.remove();
        }
        // --- END: Remove existing dynamic items --- 

        if (user) {
            if (userNameElement) userNameElement.textContent = user.name || user.email || 'My Account';
            if (accountMenu) accountMenu.style.display = 'block';
            if (loginButton) loginButton.style.display = 'none';

            // Update dropdown links (Consider simplifying if multiple links go to same place)
            const profileLink = root.getElementById('profile-link');
            // const settingsLink = root.getElementById('settings-link'); // Removed, points to profile
            // const companyLink = root.getElementById('company-link'); // Removed, points to profile
            const subscriptionLink = root.getElementById('subscription-link');
            const logoutLi = root.querySelector('#logout-link')?.closest('li'); // Find logout li
            console.log('[updateUserInfo] Found logoutLi:', logoutLi); // DEBUGGING

            if(profileLink) profileLink.href = 'user.html#profile';
            // if(settingsLink) settingsLink.href = 'user.html#profile'; 
            // if(companyLink) companyLink.href = 'user.html#profile';
            if(subscriptionLink) subscriptionLink.href = 'user.html#billing';

            // Determine if user is an admin type
            const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN' || user.is_admin === true;
            console.log(`[updateUserInfo] isAdmin check based on role ('${user.role}') or is_admin ('${user.is_admin}'):`, isAdmin); // DEBUGGING

            if (isAdmin && dropdownUl) {
                // --- START: Add Admin/Super Admin Indicator --- 
                const indicatorLi = document.createElement('li');
                indicatorLi.id = 'admin-indicator-li';
                indicatorLi.textContent = user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';
                indicatorLi.style.padding = '8px 16px';
                indicatorLi.style.color = '#6c757d'; // Bootstrap secondary color
                indicatorLi.style.fontSize = '0.875em';
                indicatorLi.style.textAlign = 'center';
                indicatorLi.style.borderBottom = '1px solid #eee'; // Separator below indicator

                // Insert indicator at the top of the dropdown list
                if (dropdownUl.firstChild) {
                    dropdownUl.insertBefore(indicatorLi, dropdownUl.firstChild);
                } else {
                    dropdownUl.appendChild(indicatorLi);
                }
                // --- END: Add Admin/Super Admin Indicator --- 

                // --- START: Add Admin Panel Link --- 
                const adminLi = document.createElement('li');
                adminLi.id = 'admin-link-li'; // ID for easy removal
                const adminLink = document.createElement('a');
                adminLink.href = '/admin.html';
                adminLink.textContent = 'Admin Panel';
                adminLink.id = 'admin-panel-link';
                adminLi.appendChild(adminLink);

                const separatorLi = document.createElement('li');
                separatorLi.style.padding = '0'; 
                separatorLi.innerHTML = '<hr style="margin: 4px 0; border-color: #eee;">';

                if (logoutLi) {
                    dropdownUl.insertBefore(separatorLi, logoutLi);
                    dropdownUl.insertBefore(adminLi, logoutLi);
                } else {
                    dropdownUl.appendChild(separatorLi);
                    dropdownUl.appendChild(adminLi);
                }
                 // --- END: Add Admin Panel Link --- 
            }

        } else {
            // Handle logged-out state (admin items are already removed above)
            if (userNameElement) userNameElement.textContent = '';
            if (accountMenu) accountMenu.style.display = 'none';
            if (loginButton) loginButton.style.display = 'inline-block';
        }
    }
    
    // Logout function needs to clear 'user' key
    async function logout() { // Assuming this is called by an event listener
        console.log('Logging out...');
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, { 
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